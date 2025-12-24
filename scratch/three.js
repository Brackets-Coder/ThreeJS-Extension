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
  const canvas = renderer.canvas
  const runtime = vm.runtime

  const bT = Scratch.BlockType //is this useful?
  const aT = Scratch.ArgumentType

  const extensionId = 'turboThreeD';

  //const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js');
  //const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js')
  const THREE = await Scratch.external.importModule("https://esm.sh/three@0.180.0")

  //Might be a good idea to start an API
  window._ThreeJS_ = {
    THREE: THREE
  }
  console.log(window._ThreeJS_);

//made by Vadik1 - Thanks!
const Skin = renderer.exports.Skin;
class SimpleSkin extends Scratch.vm.renderer.exports.Skin {
    constructor(id, renderer) {
      super(id, renderer);
      const gl = renderer.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this._texture = texture;
      this._nativeSize = renderer.getNativeSize();
      this._boundOnNativeSizeChanged = this.onNativeSizeChanged.bind(this);
      this._rotationCenter = [this._nativeSize[0] / 2, this._nativeSize[1] / 2];
      renderer.on("NativeSizeChanged", this._boundOnNativeSizeChanged);
      this.resizeCanvas();
    }
    dispose() {
      renderer.removeListener(
        "NativeSizeChanged",
        this._boundOnNativeSizeChanged
      );
      if (this._texture) {
        this._renderer.gl.deleteTexture(this._texture);
        this._texture = null;
      }
      super.dispose();
    }
    get size() {
      return this._nativeSize;
    }
    getTexture(scale) {
      return this._texture || super.getTexture();
    }
    updateContent() {
      const gl = this._renderer.gl;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas
      );
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this._silhouette.update(canvas);
      this.emitWasAltered();
    }
    resizeCanvas() {
      if (renderer.useHighQualityRender) {
        canvas.width = renderer.canvas.width;
        canvas.height = renderer.canvas.height;
      } else {
        canvas.width = this._nativeSize[0];
        canvas.height = this._nativeSize[1];
      }
      runtime.startHats(`${extensionId}_whenCanvasResized`);
      this.updateContent();
    }
    onNativeSizeChanged(event) {
      this._nativeSize = event.newSize;
      this._rotationCenter = [this._nativeSize[0] / 2, this._nativeSize[1] / 2];
      this.resizeCanvas();
    }
}
function addSimple3DLayer(publicApi) {
  // Register new drawable group "simple3D"
  // To undertsand how this patch works, first understand how those are interconnected:
  // renderer._groupOrdering => renderer._layerGroups => renderer._drawList => renderer._allDrawables
  let index = renderer._groupOrdering.indexOf("video");
  renderer._groupOrdering.splice(index + 1, 0, "simple3D");
  renderer._layerGroups["simple3D"] = {
    groupIndex: 0,
    drawListOffset: renderer._layerGroups["video"].drawListOffset,
  };
  for (let i = 0; i < renderer._groupOrdering.length; i++) {
    renderer._layerGroups[renderer._groupOrdering[i]].groupIndex = i;
  }

  // Create drawable and skin
  skinId = renderer._nextSkinId++;
  const skin = new SimpleSkin(skinId, renderer);
  renderer._allSkins[skinId] = skin;
  drawableId = renderer.createDrawable("simple3D");
  const drawable = renderer._allDrawables[drawableId];
  renderer.updateDrawableSkinId(drawableId, skinId);

  // Detect resizing
  drawable.setHighQuality = function (...args) {
    Object.getPrototypeOf(this).setHighQuality(...args);
    this.skin.resizeCanvas();
  };

  // Support for SharkPool's Layer Control extension
  drawable.customDrawableName = "Simple3D Layer";

  if (!redraw) {
    const drawOriginal = renderer.draw;
    renderer.draw = function () {
      if (this.dirty && redraw) redraw();
      drawOriginal.call(this);
    };
  }

  redraw = function () {
    if (canvasDirty) {
      skin.updateContent(canvas);
      canvasDirty = false;
    }
  };
  redraw();
}
function removeSimple3DLayer() {
  renderer.destroyDrawable(drawableId, "simple3D");
  renderer.destroySkin(skinId);

  const index = renderer._groupOrdering.indexOf("simple3D");
  if (index == -1) return;
  const start = renderer._layerGroups["simple3D"].drawListOffset;
  const end =
    renderer._layerGroups[renderer._groupOrdering[index + 1]].drawListOffset;
  if (start !== end) return;
  renderer._groupOrdering.splice(index, 1);
  delete renderer._layerGroups["simple3D"];
  for (let i = 0; i < renderer._groupOrdering.length; i++) {
    renderer._layerGroups[renderer._groupOrdering[i]].groupIndex = i;
  }
  publicApi.redraw = null;
}

let drawableId = null;
let skinId = null;
let canvasDirty = true;
let redraw = null;
addSimple3DLayer()

  class ThreeJS {
    getInfo() {
      return {
        id: extensionId,
        name: Scratch.translate('ThreeJS'),
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
const width = renderer.canvas.width, height = renderer.canvas.height

const camera = new THREE.PerspectiveCamera( 70, width / height, 0.01, 10 );
camera.position.z = 1;

const scene = new THREE.Scene();

const geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
const material = new THREE.MeshNormalMaterial();

const mesh = new THREE.Mesh( geometry, material );
scene.add( mesh );

const threeRenderer = new THREE.WebGLRenderer( { antialias: true } );
threeRenderer.setSize( width, height );
threeRenderer.setAnimationLoop( animate )
console.log(threeRenderer)

renderer.addOverlay( threeRenderer.domElement, "manual" ) // change to layered method

function animate( time ) {

	mesh.rotation.x = time / 2000;
	mesh.rotation.y = time / 1000;

	threeRenderer.render( scene, camera );

}
    }

  }
  Scratch.extensions.register(new ThreeJS());
})(Scratch);