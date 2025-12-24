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
  const bT = Scratch.BlockType //is this useful?
  const aT = Scratch.ArgumentType

  //const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js');
  //const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js')
  const THREE = await Scratch.external.importModule("https://esm.sh/three@0.180.0")

  //Might be a good idea to start an API
  window._ThreeJS_ = {
    THREE: THREE
  }
  console.log(window._ThreeJS_);

  class ThreeJS {
    getInfo() {
      return {
        id: 'turboThree',
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
const width = vm.renderer.canvas.width, height = vm.renderer.canvas.height

const camera = new THREE.PerspectiveCamera( 70, width / height, 0.01, 10 );
camera.position.z = 1;

const scene = new THREE.Scene();

const geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
const material = new THREE.MeshNormalMaterial();

const mesh = new THREE.Mesh( geometry, material );
scene.add( mesh );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( width, height );
renderer.setAnimationLoop( animate )
console.log(renderer)

vm.renderer.addOverlay( renderer.domElement, "manual" ) // change to layered method

function animate( time ) {

	mesh.rotation.x = time / 2000;
	mesh.rotation.y = time / 1000;

	renderer.render( scene, camera );

}
    }

  }
  Scratch.extensions.register(new ThreeJS());
})(Scratch);