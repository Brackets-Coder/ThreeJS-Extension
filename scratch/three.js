// Name: ThreeJS
// ID: turboThree
// Description: Blocks for creating and manipulating 3D objects using the Three.js library. (insert better description here).
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// By: Civero <https://scratch.mit.edu/users/Civero/>
// By: Drago-Cuven <https://scratch.mit.edu/users/DragoCuven/>
// License: MPL-2.0 and MIT

// Started collaboratively 23 December 2025

(async function(Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('This three.js extension must run unsandboxed');
  }

  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const runtime = vm.runtime;
  
  const bT = Scratch.BlockType; //is this useful?
  const aT = Scratch.ArgumentType;
  
  let width = runtime.stageWidth, height = runtime.stageHeight;
  const pixelScale = 2; //+resolution, -performance (probably)

  //const THREE = await import('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js');
  //const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js');
  const THREE = await import("https://esm.sh/three@0.180.0");
  
  let three, buffers, loopId, clock;
  let scene, camera, mesh; //just for now (so the loop has them), can change later to an object or whatever
    
  const setupThree = () => {
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true, alpha: true,  });
    const context = renderer.getContext(); //is it faster if i define it here?

    renderer.setPixelRatio(pixelScale);
    renderer.setSize( width, height);

    return { renderer, context};
  };
  const setupSkin = () => {
    let rawBuffer = new ArrayBuffer(width*pixelScale * height*pixelScale * 4);
    let gpuView = new Uint8Array(rawBuffer);
    let renderData = new ImageData(new Uint8ClampedArray(rawBuffer), width*pixelScale, height*pixelScale);

    class ThreeSkin extends renderer.exports.Skin {
      constructor() {
        super(renderer._nextSkinId++, renderer);
        const gl = renderer.gl;

        this._texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.updateSize(width, height, pixelScale);
      }

      getTexture() {
        return this._texture;
      }  
      updateTexture(data) {
        const gl = this._renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); //what is this for?
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width*pixelScale, height*pixelScale, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); //mmmhh

        this.emitWasAltered();
      }
      updateSize(width, height, pixelScale) {
        this._size = [width, height];
        this._rotationCenter = [width / 2, height / 2];

        const gl = this._renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width*pixelScale, height*pixelScale, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        
        this.emitWasAltered();
      }
      get size() {
        return this._size;
      }
      dispose() {
        if (this._texture) {
          this._renderer.gl.deleteTexture(this._texture);
          this._texture = null;
        }
        super.dispose();
      }
    }

    console.log(three);

    three.skin = new ThreeSkin();
    renderer._allSkins[three.skin.id] = three.skin;
    const threeDrawableId = renderer.createDrawable("pen");
    renderer.updateDrawableSkinId(threeDrawableId, three.skin.id);
    renderer._allDrawables[threeDrawableId].customDrawableName = "Three Layer";

    return {gpuView, renderData, threeDrawableId};
  };

  function init() {
    three = setupThree();
    buffers = setupSkin();

    clock = new THREE.Clock();

    window._ThreeJS_ = {
      THREE: THREE,
      get three() {return three;},
    };

    runtime.on('STAGE_SIZE_CHANGED', () => requestAnimationFrame(() => resize()));
    
    runtime.on('PROJECT_START', () => {loopId = requestAnimationFrame(loop);});
    runtime.on('PROJECT_STOP_ALL', () => {if (loopId) {cancelAnimationFrame(loopId); loopId = null;}});
    loop(); //autostart?
  }

  function resize() {
    width = runtime.stageWidth, height = runtime.stageHeight;
    console.log(width, height);

    //recreate buffers, "texture" dimensions
    buffers.rawBuffer = new ArrayBuffer(width*pixelScale * height*pixelScale * 4);
    buffers.gpuView = new Uint8Array(buffers.rawBuffer);
    buffers.renderData = new ImageData(new Uint8ClampedArray(buffers.rawBuffer), width*pixelScale, height*pixelScale);

    three.renderer.setSize( width, height);
    three.skin.updateSize(width, height, pixelScale);

    //would update camera aspect too! (future)
  }

  const loop = () => {

    loopId = requestAnimationFrame(loop);

    const delta = clock.getDelta();

    if (camera && scene && mesh) {
      //animation (delete)
      mesh.rotation.x +=  delta * 2* Math.random();
      mesh.rotation.y +=  delta * 2* Math.random();
      mesh.rotation.z +=  delta * 2* Math.random();

      three.renderer.render( scene, camera );

      three.context.readPixels(0, 0, width*pixelScale, height*pixelScale, three.context.RGBA, three.context.UNSIGNED_BYTE, buffers.gpuView);
      three.skin.updateTexture(buffers.renderData);
      renderer.dirty = true;
    }
    
  };

  Promise.resolve(init())
  .then(()=>{ console.log("loaded Three Packages? i guess ");

  class ThreeJS {
    getInfo() {
      return {
        id: 'turboJS', //lets do a poll of smth to choose this?
        name: Scratch.translate('ThreeJS'), //what is the translation of that
        color1: '#59b367',
        color2: '#438a7cff',
        color3: '#407e4cff',
        blockIconURI: 'data:image/png;base64,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',
        menuIconURI: '',

        blocks: [

          {opcode: 'test', blockType: bT.COMMAND, text: "init a scene", arguments: {}},
          {opcode: 'renderer', blockType: bT.COMMAND, text: 'set renderer [PROPERTY] to [VALUE]', arguments: {PROPERTY: {type: aT.STRING, menu: 'rendererProperties'}, VALUE: {type: aT.STRING, defaultValue: 'false'}}},

          '---',

          //{opcode: 'name', blockType: bT.COMMAND, text: 'create [TYPE] named [NAME]', arguments: {TYPE: {type: aT.STRING, menu: 'objectType'}, NAME: {type: aT.STRING, defaultValue: 'object'}}},
          //{opcode: 'uuid', blockType: bT.REPORTER, text: 'create [TYPE]', arguments: {TYPE: {type: aT.STRING, menu: 'objectType'}}},

          //{opcode: 'uuid', blockType: bT.REPORTER, text: 'create [TYPE] named [NAME]', arguments: {TYPE: {type: aT.STRING, menu: 'objectType'}, NAME: {type: aT.STRING, defaultValue: 'object'}}},

        ],
        menus: {
          objectType: {items: ['Mesh', 'Sprite', '...']},
          rendererProperties: {items: ['autoClear']}
        }
      };
    }

    test() {

      camera = new THREE.PerspectiveCamera( 70, width / height, 0.01, 10 );
      camera.position.z = 5;

      scene = new THREE.Scene();

      const geometry = new THREE.TorusKnotGeometry();
      const material = new THREE.MeshNormalMaterial();

      mesh = new THREE.Mesh( geometry, material );
      scene.add( mesh );

    }

    uuid(args) {
      const obj = new THREE[args.TYPE]();
      return obj.uuid;
    }

    renderer(args) {
      three.renderer[args.PROPERTY] = JSON.parse(args.VALUE); //is there a better way than .parse?
    }

  }
  Scratch.extensions.register(new ThreeJS());

  }).catch(err => {console.error("error! damm, better luck next time!", err.message);}); //motivation

})(Scratch);