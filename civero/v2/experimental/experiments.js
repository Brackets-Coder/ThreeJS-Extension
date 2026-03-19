// Name: ThreeJS Experimental Addon
// ID: turboThree
// Description: Unstable extension. Will be testing things here, might move them to other places.
// By: Civero <https://scratch.mit.edu/users/Civero/>
// License: MPL-2.0 and MIT

// Started 13 March 2026

(async function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("Three.js Addons must run unsandboxed");
  }
  
  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const runtime = vm.runtime;

  if (!runtime.extensionManager._loadedExtensions.get("threejsextensionciveroversion")) {
    throw new Error("This addon must be loaded with the main extension. See ThreeJS-Extension/civero/v2/three2.js");
  }

  const extensionID = "threejsTestAddon";
  const extensionIcon = 'data:image/png;base64,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';
  
  const THREE = _ThreeJS_.THREE;
  const three = _ThreeJS_.three;
  const scene = _ThreeJS_.scene;
  let camera = _ThreeJS_.camera;
  let assets = _ThreeJS_.assets;

  const { GroundedSkybox } = await import('https://esm.sh/three@0.182.0/addons/objects/GroundedSkybox.js');
  const { Water } = await import('https://esm.sh/three@0.182.0/addons/objects/Water.js');
  const { Reflector } = await import('https://esm.sh/three@0.182.0/addons/objects/Reflector.js');

  //do smth about this
  const { Octree } = await import('https://esm.sh/three@0.182.0/addons/math/Octree.js');
  const { OctreeHelper } = await import('https://esm.sh/three@0.182.0/addons/helpers/OctreeHelper.js');
  /*const octree = new Octree();
  const helper = new OctreeHelper( octree );
  scene.add( helper );*/

  async function init() {}

  Promise.resolve(init())
    .then(() => {

      class ThreeJSAddon {
        getInfo() {
          return {
            id: extensionID,
            name: "Experiments",
            color1: "#4D5061",
            color2: "#30323D",
            color3: "#606060",
            menuIconURI: extensionIcon,
            blockIconURI: extensionIcon,
            docsURI: "https://github.com/Brackets-Coder/ThreeJS-Extension",
            blocks: [

              {
                opcode: "sky",
                blockType: "command",
                color1: "#5FAD56",
                text: "add Grounded Skybox [NAME] texture [MAP] height [H] radius [R] resolution [RES]",
                arguments: {
                  NAME: {type: "string", defaultValue: "sky"},
                  MAP: {type: "string", defaultValue: "sky"},
                  H: {type: "number", defaultValue: 15},
                  R: {type: "number", defaultValue: 100},
                  RES: {type: "number", defaultValue: 128},
                }
              },

              "---",
              {
                opcode: "reflector",
                blockType: "command",
                color1: "#5FAD56",
                text: "add Reflector [NAME] geometry [G]",
                arguments: {
                  NAME: {type: "string", defaultValue: "mirror"},
                  G: {type: "string", defaultValue: "plane"},
                }
              },
              "---",
              {
                opcode: "water",
                blockType: "command",
                color1: "#5FAD56",
                text: "add Water [NAME] geometry [G] normal texture [N] sun direction [SD] [C] distortion [DS]",
                arguments: {
                  NAME: {type: "string", defaultValue: "water"},
                  G: {type: "string", defaultValue: "plane"},
                  N: {type: "string", defaultValue: "waterNormal"},
                  SD: {type: "string", defaultValue: "[0.707, 0.707, 0]"},
                  C: {type: "color", defaultValue: "#7F7F7F"},
                  DS: {type: "number", defaultValue: "20"},
                }
              },/*
              "---",
              {
                opcode: "octree",
                blockType: "reporter",
                color1: "#9e3252",
                text: "check collision with [OBJECT] [MODE]",
                arguments: {
                  OBJECT: {type: "string", defaultValue: "object"},
                  MODE: {type: "string", defaultValue: "capsule"},
                }
              },*/

            ],
            menus: {},
          };
        }

        sky(args) {
          if (assets.objects.get(args.NAME)) return;
          const map = assets.textures.get(args.MAP); if (!map) {console.warn(`No texture ${args.MAP}`); return;}

          const obj = new GroundedSkybox(map, args.H, args.R, args.RES);

          assets.objects.set(args.NAME, obj);
          scene.add(obj);
        }
        
        reflector(args) {
          if (assets.objects.get(args.NAME)) return;
          const geo = assets.geometries.get(args.G);
          if (!geo) {console.warn(`No geometry ${args.G}`); return;}

          const obj = new Reflector(geo);

          assets.objects.set(args.NAME, obj);
          scene.add(obj);
        }
        
        water(args) {
          if (assets.objects.get(args.NAME)) return;
          const geo = assets.geometries.get(args.G);
          if (!geo) {console.warn(`No geometry ${args.G}`); return;}

          const wN = assets.textures.get(args.N); if (!wN) {console.warn(`No texture ${args.N}`); return;}

          const obj = new Water(geo, {
            waterNormals: wN,
            sunDirection: new THREE.Vector3(...JSON.parse(args.SD)),
            waterColor: new THREE.Color(args.C),
            distortionScale: args.DS,
            side: 2,
            fog: true,
          });

          assets.objects.set(args.NAME, obj);
          scene.add(obj);
        }
/*
        octree(args) {
          const obj = assets.objects.get(args.OBJECT);
          if (!obj) {console.warn(`No object ${args.OBJECT}`); return;}
          console.log(octree)
          const result = octree.capsuleIntersect( obj );
          console.log(result);
          return result;
        }
*/
      }

      Scratch.extensions.register(new ThreeJSAddon());

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
