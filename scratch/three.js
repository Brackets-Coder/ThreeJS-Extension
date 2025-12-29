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
  const renderer = vm.renderer
  const runtime = vm.runtime
  
  const bT = Scratch.BlockType //is this useful?
  const aT = Scratch.ArgumentType
  
  const width = runtime.stageWidth, height = runtime.stageHeight;
  const pixelScale = 2 //+resolution, -performance (probably)

  //const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js');
  //const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js')
  const THREE = await Scratch.external.importModule("https://esm.sh/three@0.180.0")
  let three, buffers
    
  const setupThree = () => {
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true, alpha: true });
    const context = renderer.getContext() //is it faster if i define it here?

    renderer.setPixelRatio(pixelScale)
    renderer.setSize( width, height)

    return { renderer, context}
  }
  const setupSkin = () => {
    const rawBuffer = new ArrayBuffer(width*pixelScale * height*pixelScale * 4);
    const gpuView = new Uint8Array(rawBuffer);
    const clampedView = new Uint8ClampedArray(rawBuffer);
    const renderData = new ImageData(clampedView, width*pixelScale, height*pixelScale);

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

        this.updateSize(width, height, pixelScale)
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

    console.log(three)

    three.skin = new ThreeSkin();
    renderer._allSkins[three.skin.id] = three.skin;
    const threeDrawableId = renderer.createDrawable("pen");
    renderer.updateDrawableSkinId(threeDrawableId, three.skin.id);
    renderer._allDrawables[threeDrawableId].customDrawableName = "Three Layer";

    //renderer.markDrawableAsNoninteractive(threeDrawableId)
    //renderer._allDrawables[threeDrawableId]._highQuality = true

    return {gpuView, renderData, threeDrawableId}
  }

  function init() {
    three = setupThree()
    buffers = setupSkin()

    window._ThreeJS_ = {
      THREE: THREE,
      get three() {return three},
    }
  }

  Promise.resolve(init())
  .then(()=>{

  console.log("loaded Three Packages? i guess ")

  class ThreeJS {
    getInfo() {
      return {
        id: 'turboJS', //lets do a poll of smth to choose this?
        name: Scratch.translate('ThreeJS'), //what is the translation of that
        color1: '',
        color2: '',
        color3: '',
        blockIconURI: '',
        menuIconURI: '',

        blocks: [

          {opcode: 'test', blockType: bT.COMMAND, text: "init a scene", arguments: {}}

        ],
        menus: {

        }
      };
    }

    async test() {

      const camera = new THREE.PerspectiveCamera( 70, width / height, 0.01, 10 );
      camera.position.z = 5;

      const scene = new THREE.Scene();

      const geometry = new THREE.TorusKnotGeometry();
      const material = new THREE.MeshNormalMaterial();

      const mesh = new THREE.Mesh( geometry, material );
      scene.add( mesh );

      three.renderer.setAnimationLoop( animate )

      function animate( time ) {

        mesh.rotation.x = time / 2000;
        mesh.rotation.y = time / 1000;
        mesh.position.z = 2.5 * Math.sin(time / 1000)

        three.renderer.render( scene, camera );

        three.context.readPixels(0, 0, width*pixelScale, height*pixelScale, three.context.RGBA, three.context.UNSIGNED_BYTE, buffers.gpuView)
        //three.skin._setTexture(renderData); this is an already existing method in scratch
        three.skin.updateTexture(buffers.renderData) //mine, instead of using texImage2D uses texSubImage2D, they say its faster?

        renderer.dirty = true
      }

    }

  }
  Scratch.extensions.register(new ThreeJS());

  })
  .catch(err => {console.error("error! damm, better luck next time!", err.message)}) //motivation

})(Scratch);