'use strict';

// Submit the campaign mesh streams and materials into a Pixi render texture.
class PixiMapRenderer {
 constructor(renderer, shaders, mapSize, depth, rows, sampleCount=4) {
  Object.assign(this, {renderer, shaders, mapSize, depth, rows, device:renderer.gpu.device,
   sampleCount:[1,4].includes(sampleCount)?sampleCount:4});
  // Constants used by the shared map drawing commands.
  const names=['ARRAY_BUFFER','STATIC_DRAW','DYNAMIC_DRAW','FLOAT','TRIANGLES','TEXTURE_2D',
   'TEXTURE_WRAP_S','TEXTURE_WRAP_T','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR',
   'NEAREST','LINEAR_MIPMAP_LINEAR','CLAMP_TO_EDGE','REPEAT','RGBA','LUMINANCE','UNSIGNED_BYTE',
   'STENCIL_TEST','DEPTH_TEST','BLEND','ALWAYS','EQUAL','KEEP','REPLACE','LEQUAL','MAX_TEXTURE_SIZE'];
  names.forEach((key,index)=>this[key]=index+16);
  Object.assign(this,{TEXTURE0:100,COLOR_BUFFER_BIT:1,DEPTH_BUFFER_BIT:2,STENCIL_BUFFER_BIT:4});
  this.attribs=[];this.enabledAttributes=new Set();this.flags=new Set();
  this.units=[];this.groups=new Map();this.pipelines=new Map();this.pages=[];
  this.programs=new Map();this.nextView=1;this.depthWrite=true;this.edge=0;this.treeUnit=2;
  this.uniformBytes=(Math.floor(Math.max(...Object.values(shaders.uniforms))/4)+1)*16;
  this.constantEdge=this.device.createBuffer({size:4,usage:GPUBufferUsage.VERTEX});
  const visibility=GPUShaderStage.FRAGMENT;
  this.uniformLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:visibility|GPUShaderStage.VERTEX,buffer:{type:'uniform',hasDynamicOffset:true,minBindingSize:this.uniformBytes}}]});
  this.imageUnits=[0,1,2,3,4,5,6,7,11,12,13,14,15]; // 8–10 are the shared samplers.
  this.imageLayout=this.device.createBindGroupLayout({entries:[
   ...this.imageUnits.map(binding=>({binding,visibility,texture:{sampleType:'float'}})),
   ...[8,9,10].map(binding=>({binding,visibility,sampler:{type:'filtering'}}))
  ]});
  this.layout=this.device.createPipelineLayout({bindGroupLayouts:[this.uniformLayout,this.imageLayout]});
  this.samplers=[
   this.device.createSampler({addressModeU:'repeat',addressModeV:'repeat',minFilter:'linear',magFilter:'linear',mipmapFilter:'linear',maxAnisotropy:4}),
   this.device.createSampler({minFilter:'linear',magFilter:'linear',mipmapFilter:'linear',maxAnisotropy:4}),
   this.device.createSampler({})
  ];
  this.blank=this.createTexture();
  this.setImage(this.blank,new Uint8Array([255,255,255,255]),1,1);
  this.frameTexture=PIXI.RenderTexture.create({width:1,height:1,format:'rgba8unorm',resolution:1,autoGarbageCollect:false});
  this.sprite=new PIXI.Sprite(this.frameTexture);
  this.scene=new PIXI.Container();
  this.scene.addChild(this.sprite);
 }
 createMapProgram(name) {
  if(this.programs.has(name))return this.programs.get(name);
  const values=new Float32Array(this.uniformBytes/4);
  values.set([...this.mapSize,this.depth,this.rows],36);
  const pair=this.shaders.programs[name];
  const program={name,values,vertex:this.device.createShaderModule({label:name+' vertex',code:pair.vert}),
   fragment:this.device.createShaderModule({label:name+' fragment',code:pair.frag})};
  this.programs.set(name,program);
  return program;
 }
 async prepare(){
  const variants=[
   ['world',false,true,true,'off',false],['world',false,true,true,'write',false],
   ['world',true,true,true,'write',false],['world',false,true,true,'outside',false],
   ['border',false,false,false,'off',false],['forest',false,true,true,'off',true]
  ];
  await Promise.all(variants.map(async ([name,...state])=>{
   const program=this.createMapProgram(name);
   const pipeline=await this.device.createRenderPipelineAsync(this.descriptor(program,...state));
   this.pipelines.set([name,...state].join('|'),pipeline);
  }));
 }
 useProgram(program){this.program=program}
 getUniformLocation(program,name){return this.shaders.uniforms[name] ?? name}
 uniform1f(slot,x){this.program.values[slot]=x}
 uniform2f(slot,x,y){this.program.values[slot]=x;this.program.values[slot+1]=y}
 uniform3f(slot,x,y,z){this.program.values.set([x,y,z],slot)}
 uniform1i(name,unit){if(name==='uTree')this.treeUnit=unit} // All other samplers have fixed bindings.
 getAttribLocation(program,name){return {aPos:0,aColor:1,aEdge:2,aPosition:0,aUV:2,aOffset:1,aDirection:1,aSide:2}[name]}
 enableVertexAttribArray(slot){this.enabledAttributes.add(slot)}
 disableVertexAttribArray(slot){this.enabledAttributes.delete(slot)}
 vertexAttribPointer(slot){this.attribs[slot]=this.boundBuffer}
 vertexAttrib1f(slot,value){this.edge=value}
 createBuffer(){return {gpu:null}}
 bindBuffer(target,buffer){this.boundBuffer=buffer}
 bufferData(target,data){
  const handle=this.boundBuffer;
  if(!data.byteLength)return;
  if(!handle.gpu || handle.gpu.size<data.byteLength){
   handle.gpu?.destroy();
   handle.gpu=this.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
  }
  this.device.queue.writeBuffer(handle.gpu,0,data);
 }
 deleteBuffer(handle){handle?.gpu?.destroy()}
 createTexture(){return {source:null,view:null,id:0}}
 activeTexture(unit){this.activeUnit=unit-this.TEXTURE0}
 bindTexture(target,texture){this.units[this.activeUnit]=texture}
 setImage(handle,resource,width,height){
  handle.source?.destroy();
  const options={resource,width,height,format:'rgba8unorm',alphaMode:'no-premultiply-alpha',autoGarbageCollect:false};
  const bytes=ArrayBuffer.isView(resource);
  if(!bytes && typeof HTMLImageElement!=='undefined' && resource instanceof HTMLImageElement){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   canvas.getContext('2d').drawImage(resource,0,0);
   options.resource=canvas;
  }
  const Source=bytes?PIXI.BufferImageSource:PIXI.ImageSource;
  handle.source=new Source(options);
  // ImageSource resets this option in its constructor. Pixi cannot track
  // native bind-group usage, so the campaign owns the lifetime of its images.
  handle.source.autoGarbageCollect=false;
  handle.source.on('unload',()=>{
   handle.view=null;
   this.groups.clear();
  });
  handle.view=null;
  this.groups.clear();
 }
 texImage2D(target,level,format,...args){
  const data=args.at(-1);
  const [width,height]=args.length===6?args:[data.width,data.height];
  this.setImage(this.units[this.activeUnit],data,width,height);
 }
 generateMipmap(){this.units[this.activeUnit].source.autoGenerateMipmaps=true}
 image(handle){
  if(!handle?.source)handle=this.blank;
  if(!handle.view){
   handle.view=this.renderer.texture.getGpuSource(handle.source).createView();
   handle.id=this.nextView++;
  }
  return handle;
 }
 material(){
  const images=this.imageUnits.map(unit=>this.image(this.units[unit===2&&this.program.name==='forest'?this.treeUnit:unit]));
  const key=images.map(image=>image.id).join(',');
  let group=this.groups.get(key);
  if(!group){
   group=this.device.createBindGroup({layout:this.imageLayout,entries:[
    ...images.map((image,i)=>({binding:this.imageUnits[i],resource:image.view})),
    ...this.samplers.map((resource,i)=>({binding:i+8,resource}))
   ]});
   this.groups.set(key,group);
  }
  return group;
 }
 getParameter(){return this.device.limits.maxTextureDimension2D}
 getShaderPrecisionFormat(){return {precision:23}}
 getContextAttributes(){return {stencil:true}}
 // Filtering and coordinate orientation are fixed by the material bindings.
 texParameteri(){} pixelStorei(){} depthFunc(){} blendFunc(){} stencilMask(){} stencilOp(){} clearStencil(){}
 enable(flag){this.flags.add(flag)}
 disable(flag){this.flags.delete(flag)}
 depthMask(write){this.depthWrite=write}
 stencilFunc(mode,reference){this.stencilMode=mode;this.reference=reference}
 clearColor(r,g,b,a){this.background={r,g,b,a}}
 viewport(x,y,w,h){this.resize(w,h)}
 resize(w,h){
  if(this.depthTexture?.width===w && this.depthTexture.height===h)return;
  this.renderer.resize(w,h,1);
  const oldFrame=this.frameTexture;
  this.frameTexture=PIXI.RenderTexture.create({width:w,height:h,format:'rgba8unorm',resolution:1,autoGarbageCollect:false});
  this.sprite.texture=this.frameTexture;
  oldFrame.destroy(true);
  this.sprite.width=w;this.sprite.height=h;
  this.depthTexture?.destroy();this.colorTexture?.destroy();
  const descriptor={size:[w,h],sampleCount:this.sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT};
  this.depthTexture=this.device.createTexture({...descriptor,format:'depth24plus-stencil8'});
  this.colorTexture=this.sampleCount>1?this.device.createTexture({...descriptor,format:'rgba8unorm'}):null;
 }
  // Переключение сглаживания на лету: пересоздаём мультисэмпловые текстуры,
  // конвейеры пересоберутся при следующем кадре (кэш ключуется состоянием).
  setSampleCount(count){
   count=[1,4].includes(count)?count:4;
   if(this.sampleCount===count)return;
   this.sampleCount=count;
   this.pipelines.clear();
   const canvas=this.renderer.canvas;
   this.depthTexture?.destroy();this.colorTexture?.destroy();
   this.depthTexture=null;this.colorTexture=null;
   this.resize(canvas.width,canvas.height);
  }
 clear(mask){
  if(!(mask&this.COLOR_BUFFER_BIT))return; // Stencil is already cleared at the start of the pass.
  const canvas=this.renderer.canvas;
  this.resize(canvas.width,canvas.height);
  this.cursor=0;
  this.encoder=this.device.createCommandEncoder({label:'Campaign map'});
  // Без мультисэмплинга рендерим прямо в кадровую текстуру: resolveTarget у
  // WebGPU допустим только для мультисэмпловых вложений.
  const msaa=this.sampleCount>1;
  this.pass=this.encoder.beginRenderPass({colorAttachments:[{
   view:msaa?this.colorTexture.createView():this.renderer.texture.getGpuSource(this.frameTexture.source).createView(),
   resolveTarget:msaa?this.renderer.texture.getGpuSource(this.frameTexture.source).createView():undefined,
   // Pixi reads the resolved frame after this pass. With MSAA off, the color attachment is the frame.
   clearValue:this.background,loadOp:'clear',storeOp:msaa?'discard':'store'
  }],depthStencilAttachment:{view:this.depthTexture.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard',
   stencilClearValue:0,stencilLoadOp:'clear',stencilStoreOp:'discard'}});
 }
 descriptor(program,weighted,depthTest,depthWrite,stencil,blend){
  const attribute=(shaderLocation,offset,format)=>({shaderLocation,offset,format});
  const position=attribute(0,0,'float32x3');
  let buffers;
  if(program.name==='world')buffers=[
   {arrayStride:24,attributes:[position,attribute(1,12,'float32x3')]},
   {arrayStride:4,stepMode:weighted?'vertex':'instance',attributes:[attribute(2,0,'float32')]}];
  else if(program.name==='forest')buffers=[{arrayStride:28,attributes:[position,attribute(1,12,'float32x2'),attribute(2,20,'float32x2')]}];
  else buffers=[{arrayStride:28,attributes:[position,attribute(1,12,'float32x3'),attribute(2,24,'float32')]}];
  const face=stencil==='write'?{passOp:'replace'}:stencil==='outside'?{compare:'equal'}:{};
  const target={format:'rgba8unorm'};
  if(blend)target.blend={color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}};
  return {label:program.name,layout:this.layout,vertex:{module:program.vertex,entryPoint:'main',buffers},
   fragment:{module:program.fragment,entryPoint:'main',targets:[target]},primitive:{topology:'triangle-list'},
   depthStencil:{format:'depth24plus-stencil8',depthWriteEnabled:depthTest&&depthWrite,depthCompare:depthTest?'less-equal':'always',
    stencilFront:face,stencilBack:face,stencilWriteMask:stencil==='write'?255:0},multisample:{count:this.sampleCount}};
 }
 uniformPage(index){
  if(!this.pages[index]){
   const data=new Float32Array(64*256);
   const buffer=this.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
   const group=this.device.createBindGroup({layout:this.uniformLayout,entries:[{binding:0,resource:{buffer,size:this.uniformBytes}}]});
   this.pages[index]={data,buffer,group};
  }
  return this.pages[index];
 }
 drawArrays(kind,first,count){
  const program=this.program,world=program.name==='world',weighted=world&&this.enabledAttributes.has(2);
  const stencil=this.flags.has(this.STENCIL_TEST)?(this.stencilMode===this.EQUAL?'outside':'write'):'off';
  const state=[weighted,this.flags.has(this.DEPTH_TEST),this.depthWrite,stencil,this.flags.has(this.BLEND)];
  const key=[program.name,...state].join('|');
  let pipeline=this.pipelines.get(key);
  if(!pipeline){
   pipeline=this.device.createRenderPipeline(this.descriptor(program,...state));
   this.pipelines.set(key,pipeline);
  }
  const page=this.uniformPage(Math.floor(this.cursor/256)),slot=this.cursor++%256;
  program.values[this.shaders.uniforms.uDefaultEdge]=weighted?0:this.edge;
  page.data.set(program.values,slot*64);
  this.pass.setPipeline(pipeline);
  this.pass.setStencilReference(this.reference||0);
  this.pass.setBindGroup(0,page.group,[slot*256]);
  this.pass.setBindGroup(1,this.material());
  this.pass.setVertexBuffer(0,this.attribs[0].gpu);
  if(world)this.pass.setVertexBuffer(1,weighted?this.attribs[2].gpu:this.constantEdge);
  this.pass.draw(count,1,first);
 }
 present(){
  this.pass.end();
  for(let i=0;i<Math.ceil(this.cursor/256);i++){
   const page=this.pages[i];
   this.device.queue.writeBuffer(page.buffer,0,page.data,0,Math.min(256,this.cursor-i*256)*64);
  }
  this.device.queue.submit([this.encoder.finish()]);
  this.renderer.render(this.scene);
 }
}
