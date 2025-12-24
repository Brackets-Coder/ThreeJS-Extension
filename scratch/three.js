// Name: ThreeJS
// ID: turboThree
// Description: Blocks for creating and manipulating 3D objects using the Three.js library. (insert better description here).
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// By: Civero <https://scratch.mit.edu/users/Civero/>
// By: Drago-Cuven <https://scratch.mit.edu/users/DragoCuven/>
// License: MPL-2.0 and MIT

// Started collaboratively December 2025

(async function(Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('This three.js extension must run unsandboxed');
  }

  const vm = Scratch.vm;

  const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js');

  console.log(THREE);

  class ThreeJS {
    getInfo() {
      return {
        id: 'turboThree',
        name: Scratch.translate('ThreeJS'),
        blocks: [

        ]
      };
    }
  }

  Scratch.extensions.register(new ThreeJS());
})(Scratch);