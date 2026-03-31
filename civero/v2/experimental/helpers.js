// Name: ThreeJS Helper Addon
// ID: turboThree
// Description: Offers blocks that help visualize scene objects better.
// By: Civero <https://scratch.mit.edu/users/Civero/>
// License: MPL-2.0 and MIT

// Started 17 March 2026

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

  const extensionID = "threejsHelperAddon";
  const extensionIcon = 'data:image/png;base64,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';
  
  const THREE = _ThreeJS_.THREE;
  const three = _ThreeJS_.three;
  const scene = _ThreeJS_.scene;
  let camera = _ThreeJS_.camera;
  let assets = _ThreeJS_.assets;

  const { RectAreaLightHelper } = await import('https://esm.sh/three@0.182.0/addons/helpers/RectAreaLightHelper.js');
  const { PositionalAudioHelper } = await import('https://esm.sh/three@0.182.0/addons/helpers/PositionalAudioHelper.js');
  
  const { ViewHelper } = await import('https://esm.sh/three@0.182.0/addons/helpers/ViewHelper.js');

  const { Line2 } = await import('https://esm.sh/three@0.182.0/examples/jsm/lines/Line2.js');
  const { LineMaterial } = await import('https://esm.sh/three@0.182.0/examples/jsm/lines/LineMaterial.js');
  const { LineGeometry } = await import('https://esm.sh/three@0.182.0/examples/jsm/lines/LineGeometry.js');

  async function init() {}

  Promise.resolve(init())
    .then(() => {

      class ThreeJSAddon {
        getInfo() {
          return {
            id: extensionID,
            name: "Helpers",
            color1: "#4D5061",
            color2: "#30323D",
            color3: "#606060",
            menuIconURI: extensionIcon,
            blockIconURI: extensionIcon,
            docsURI: "https://github.com/Brackets-Coder/ThreeJS-Extension",
            blocks: [
              
              {
                opcode: "grid",
                blockType: "command",
                color1: "#5663AD",
                text: "add Grid [NAME] size [S] divisions [D] [COLOR] [COLOR2]",
                arguments: {
                  NAME: {type: "string", defaultValue: "grid"},
                  S: {type: "number", defaultValue: 10},
                  D: {type: "number", defaultValue: 10},
                  COLOR: {type: "color"},
                  COLOR2: {type: "color"},
                }
              },
              {
                opcode: "polarGrid",
                blockType: "command",
                color1: "#5663AD",
                text: "add Polar Grid [NAME] radius [R] sectors [S] rings [I] divisions [D] [COLOR] [COLOR2]",
                arguments: {
                  NAME: {type: "string", defaultValue: "grid"},
                  R: {type: "number", defaultValue: 10},
                  S: {type: "number", defaultValue: 16},
                  I: {type: "number", defaultValue: 16},
                  D: {type: "number", defaultValue: 64},
                  COLOR: {type: "color"},
                  COLOR2: {type: "color"},
                }
              },
              
              {
                opcode: "axes",
                blockType: "command",
                color1: "#5663AD",
                text: "add Axes [NAME] size [S]",
                arguments: {
                  NAME: {type: "string", defaultValue: "axes"},
                  S: {type: "number", defaultValue: 5},
                }
              },
              "---",
              {
                opcode: "arrow",
                blockType: "command",
                color1: "#5663AD",
                text: "add Arrow [NAME] from [V3] to [T3] [COLOR]",
                arguments: {
                  NAME: {type: "string", defaultValue: "arrow"},
                  V3: {type: "string", defaultValue: "[0,0,0]"},
                  T3: {type: "string", defaultValue: "[1,0,0]"},
                  COLOR: {type: "color"},
                }
              },
              {
                opcode: "arrowD",
                blockType: "command",
                color1: "#5663AD",
                text: "set Arrow [NAME] point to [T3]",
                arguments: {
                  NAME: {type: "string", defaultValue: "arrow"},
                  T3: {type: "string", defaultValue: "[1,2,3]"},
                }
              },
              "---",
              
              {
                opcode: "box",
                blockType: "command",
                color1: "#5663AD",
                text: "add Box [NAME] of [OBJECT] [COLOR]",
                arguments: {
                  NAME: {type: "string", defaultValue: "box"},
                  OBJECT: {type: "string", defaultValue: "object"},
                  COLOR: {type: "color"},
                }
              },
              "---",
              {
                opcode: "camera",
                blockType: "command",
                color1: "#5663AD",
                text: "add Camera [NAME] from [OBJECT] [COLOR] [COLOR2] [COLOR3] [COLOR4] [COLOR5]",
                arguments: {
                  NAME: {type: "string", defaultValue: "frustum"},
                  OBJECT: {type: "string", defaultValue: "camera"},
                  COLOR: {type: "color"},
                  COLOR2: {type: "color"},
                  COLOR3: {type: "color"},
                  COLOR4: {type: "color"},
                  COLOR5: {type: "color"},
                }
              },
              {
                opcode: "point",
                blockType: "command",
                color1: "#5663AD",
                text: "add Point Light [NAME] from [OBJECT] size [S] [COLOR]",
                arguments: {
                  NAME: {type: "string", defaultValue: "limits"},
                  OBJECT: {type: "string", defaultValue: "light"},
                  S: {type: "number", defaultValue: 1},
                  COLOR: {type: "color"},
                }
              },
              {
                opcode: "spot",
                blockType: "command",
                color1: "#5663AD",
                text: "add Spot Light [NAME] from [OBJECT] [COLOR]",
                arguments: {
                  NAME: {type: "string", defaultValue: "limits"},
                  OBJECT: {type: "string", defaultValue: "light"},
                  COLOR: {type: "color"},
                }
              },
              {
                opcode: "rect",
                blockType: "command",
                color1: "#5663AD",
                text: "add Rectangular Area Light [NAME] from [OBJECT] [COLOR]",
                arguments: {
                  NAME: {type: "string", defaultValue: "area"},
                  OBJECT: {type: "string", defaultValue: "light"},
                  COLOR: {type: "color"},
                }
              },
              
              {
                opcode: "audio",
                blockType: "command",
                color1: "#5663AD",
                text: "add Audio [NAME] from [OBJECT] range [R]",
                arguments: {
                  NAME: {type: "string", defaultValue: "range"},
                  OBJECT: {type: "string", defaultValue: "audio"},
                  R: {type: "number", defaultValue: 1},
                }
              },
              
              {
                opcode: "update",
                blockType: "command",
                color1: "#5663AD",
                text: "update object helper [NAME]",
                arguments: {
                  NAME: {type: "string", defaultValue: "limits"},
                }
              },
              "---",
              
              {
                opcode: "Line2",
                blockType: "command",
                text: "add Line2 [NAME] to [PARENT]",
                color1: "#5FAD56",
                arguments: {
                  NAME: {type: "string", defaultValue: "line"},
                  PARENT: {type: "string", defaultValue: "scene"},
                }
              },
              {
                opcode: "Line2G",
                blockType: "command",
                text: "create Line2 geometry [NAME]",
                color1: "#7c4d5e",
                arguments: {
                  NAME: {type: "string", defaultValue: "line"},
                }
              },
              {
                opcode: "sLine2G",
                blockType: "command",
                text: "set Line2 geometry [NAME] vertex [PROP] [P]",
                color1: "#7c4d5e",
                arguments: {
                  NAME: {type: "string", defaultValue: "line"},
                  PROP: {type: "string", menu: "Line2G"},
                  P: {type: "string", defaultValue: "[0,0,0,0,2,0]"},
                }
              },
              {
                opcode: "Line2M",
                blockType: "command",
                text: "create Line2 Material [NAME]",
                color1: "#694D7C",
                arguments: {
                  NAME: {type: "string", defaultValue: "line"},
                }
              },
              {
                opcode: "sLine2M",
                blockType: "command",
                text: "set Line2 material [NAME] [PROP] to [P]",
                color1: "#694D7C",
                arguments: {
                  NAME: {type: "string", defaultValue: "line"},
                  PROP: {type: "string", menu: "Line2M"},
                  P: {type: "number", defaultValue: "1"},
                }
              },
              {
                opcode: "cLine2M",
                blockType: "command",
                text: "set Line2 material [NAME] color to [P]",
                color1: "#694D7C",
                arguments: {
                  NAME: {type: "string", defaultValue: "line"},
                  P: {type: "color"},
                }
              },

              "---",
              
              {
                opcode: "view",
                blockType: "command",
                text: "add View [NAME]",
                arguments: {
                  NAME: {type: "string", defaultValue: "view"},
                }
              },
            ],
            menus: {
              Line2G: {items: [
                { text: Scratch.translate("Positions"), value: "setPositions" },
                { text: Scratch.translate("Colors"), value: "setColors" },
              ]},
              Line2M: {items: [
                { text: Scratch.translate("Line Width"), value: "linewidth" },
                { text: Scratch.translate("Opacity"), value: "opacity" },
                { text: Scratch.translate("Gap Size"), value: "gapSize" },
                { text: Scratch.translate("Dash Size"), value: "dashSize" },
                { text: Scratch.translate("Dash Scale"), value: "dashScale" },
              ]}
            },
          };
        }

        addHelper(args, obj) {
          if (assets.objects.get(args.NAME)) { console.warn(`${args.NAME} already existed, replacing!`); assets.objects.get(args.NAME).removeFromParent();}
          scene.add( obj );
          assets.objects.set(args.NAME, obj);
        }

        update(args){
          const h = assets.objects.get(args.NAME);
          if(!h  || !h.type.includes("Helper")) { console.warn(`No helper named ${args.NAME}`); return;}
          h.update();
        }

        grid(args) {
          const gridHelper = new THREE.GridHelper( args.S, args.D, args.COLOR, args.COLOR2 );
          this.addHelper(args, gridHelper);
        }
        
        polarGrid(args) {
          const helper = new THREE.PolarGridHelper( args.R, args.S, args.I, args.D, args.COLOR, args.COLOR2 );
          this.addHelper(args, helper);
        }

        arrow(args) {
          const dir = new THREE.Vector3( ...JSON.parse(args.T3) );
          dir.normalize();
          const origin = new THREE.Vector3( ...JSON.parse(args.V3) );
          const length = 1;
          const arrowHelper = new THREE.ArrowHelper( dir, origin, length, args.COLOR );
          this.addHelper(args, arrowHelper);
        }
        arrowD(args) {
          const arrowHelper = assets.objects.get(args.NAME);
          if (!arrowHelper) {console.warn(`No helper named ${args.NAME}`); return;}
          const dir = new THREE.Vector3( ...JSON.parse(args.T3) );
          //dir.normalize();
          arrowHelper.setDirection(dir);
        }

        axes(args) {
          const axesHelper = new THREE.AxesHelper( args.S );
          this.addHelper(args, axesHelper);
        }

        box(args) {
          const object = assets.objects.get(args.OBJECT);
          if (!object) {console.warn(`No object named ${args.OBJECT}`); return;}
          const box = new THREE.BoxHelper( object, args.COLOR );
          this.addHelper(args, box);
        }

        camera(args) {
          const object = assets.objects.get(args.OBJECT);
          if (!object || !object.isCamera) {console.warn(`No camera object named ${args.OBJECT}`); return;}
          
          const helper = new THREE.CameraHelper( object );
          helper.setColors( new THREE.Color(args.COLOR), new THREE.Color(args.COLOR2), new THREE.Color(args.COLOR3), new THREE.Color(args.COLOR4), new THREE.Color(args.COLOR5) );
          this.addHelper(args, helper);
        }

        point(args) {
          const object = assets.objects.get(args.OBJECT);
          if (!object || !object.isPointLight) {console.warn(`No point light object named ${args.OBJECT}`); return;}
          const pointLightHelper = new THREE.PointLightHelper( object, args.S, args.COLOR );
          this.addHelper(args, pointLightHelper);
        }
        spot(args) {
          const object = assets.objects.get(args.OBJECT);
          if (!object || !object.isSpotLight) {console.warn(`No point light object named ${args.OBJECT}`); return;}
          const spotLightHelper = new THREE.SpotLightHelper( object, args.COLOR );
          this.addHelper(args, spotLightHelper);
        }
        rect(args) {
          const light = assets.objects.get(args.OBJECT);
          if (!light || !light.isRectAreaLight) {console.warn(`No rectangular area light named ${args.OBJECT}`); return;}
          const helper = new RectAreaLightHelper( light, args.COLOR );
          if (assets.objects.get(args.NAME)) { console.warn(`${args.NAME} already existed, replacing!`); assets.objects.get(args.NAME).removeFromParent();}
          light.add( helper );
          assets.objects.set(args.NAME, helper);
        }

        audio(args) {
          const object = assets.objects.get(args.OBJECT);
          if (!object) {console.warn(`No audio object named ${args.OBJECT}`); return;}
          const helper = new PositionalAudioHelper( object, args.R );
          if (assets.objects.get(args.NAME)) { console.warn(`${args.NAME} already existed, replacing!`); assets.objects.get(args.NAME).removeFromParent();}
          object.add( helper );
          assets.objects.set(args.NAME, helper);
        }

        view(args) {
          const v = new ViewHelper( camera, three.renderer.domElement );
          this.addHelper(args, v);
        }

        Line2(args) {
          const line = new Line2();
          this.addHelper( args, line );
        }
        Line2G(args) {
          const geo = new LineGeometry();
          assets.geometries.set(args.NAME, geo);
        }
        sLine2G(args) {
          const geo = assets.geometries.get(args.NAME);
          geo[args.PROP](JSON.parse(args.P));
        }
        Line2M(args) {
          const mat = new LineMaterial();
          mat.worldUnits = true;
          mat.dashed = true;
          assets.materials.set(args.NAME, mat);
        }
        sLine2M(args) {
          const mat = assets.materials.get(args.NAME);
          mat[args.PROP] = args.P;
        }
        cLine2M(args) {
          const mat = assets.materials.get(args.NAME);
          mat.color = new THREE.Color(args.P);
        }

      }

      Scratch.extensions.register(new ThreeJSAddon());

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
