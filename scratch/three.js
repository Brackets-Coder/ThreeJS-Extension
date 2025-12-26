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

const Skin = renderer.exports.Skin;

class SimpleSkin extends Skin {
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
    this._rotationCenter = [320, 180];
    this._size = [640, 360];
  }
  dispose() {
    if (this._texture) {
      this._renderer.gl.deleteTexture(this._texture);
      this._texture = null;
    }
    super.dispose();
  }
  set size(value) {
    this._size = value;
    this._rotationCenter = [value[0] / 2, value[1] / 2];
  }
  get size() {
    return this._size;
  }
  getTexture(scale) {
    return this._texture || super.getTexture(scale);
  }
  setContent(textureData) {
    const gl = this._renderer.gl;
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      textureData
    );
    this.emitWasAltered();
  }
}

let threeSkinId = null;
let threeSkin = null;
let threeDrawableId = null;

const threeRenderer = new THREE.WebGLRenderer({ /*preserveDrawingBuffer: true, antialias: false*/ });
threeRenderer.setClearColor(0x000000, 0);
threeRenderer.setSize(480, 360);

threeSkinId = renderer._nextSkinId++;
threeSkin = new SimpleSkin(threeSkinId, renderer);
renderer._allSkins[threeSkinId] = threeSkin;
threeDrawableId = renderer.createDrawable("pen");
renderer._allDrawables[threeDrawableId].customDrawableName = "Three Layer";
renderer.updateDrawableSkinId(threeDrawableId, threeSkinId)

window._ThreeJS_ = {
  THREE: THREE,
  get threeSkin() {return threeSkin},
  get threeRenderer() {return threeRenderer}
}

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
const width = runtime.stageWidth, height = runtime.stageHeight;

const camera = new THREE.PerspectiveCamera( 70, width / height, 0.01, 10 );
camera.position.z = 5;

const scene = new THREE.Scene();

const geometry = new THREE.TorusKnotGeometry();
const material = new THREE.MeshNormalMaterial();

const mesh = new THREE.Mesh( geometry, material );
scene.add( mesh );

threeRenderer.setSize( width, height );
threeSkin.size = [width, height]
threeRenderer.setAnimationLoop( animate )

	threeRenderer.render( scene, camera );
  await threeSkin.setContent(threeRenderer.domElement)
  console.log(threeSkin)

//renderer.addOverlay( threeRenderer.domElement, "manual" ) // change to layered method

function animate( time ) {

	mesh.rotation.x = time / 2000;
	mesh.rotation.y = time / 1000;
  mesh.position.z = 3 * Math.sin(time / 1000)

	threeRenderer.render( scene, camera );
  //how to update?

}
    }

  }
  Scratch.extensions.register(new ThreeJS());
})(Scratch);