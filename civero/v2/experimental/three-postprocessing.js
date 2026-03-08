// Name: ThreeJS Postprocessing Addon
// ID: turboThree
// Description: Blocks for adding postprocessing effects to the Three.js extension.
// By: Civero <https://scratch.mit.edu/users/Civero/>
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// License: MPL-2.0 and MIT

// Started 7 March 2026

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

  const extensionID = "threejsPostprocessingAddon";
  const extensionIcon = "data:image/png;base64,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";

  let width, height;
  let lastCanvas;

  const THREE = _ThreeJS_.THREE;
  let root = "https://esm.sh/three@0.182.0/examples/jsm/postprocessing/";
  const {EffectComposer} = await import(root+"EffectComposer.js");
  const {RenderPass} = await import(root+"RenderPass.js");
  const { OutputPass } =  await import(root+"OutputPass.js");

  const { HalftonePass } =  await import(root+"HalftonePass.js");

  const { GlitchPass } =  await import(root+"GlitchPass.js");
  const { BloomPass } = await import(root+"BloomPass.js");
  const { FilmPass } =  await import(root+"FilmPass.js");
  const { OutlinePass } =  await import(root+"OutlinePass.js");
  const { DotScreenPass } =  await import(root+"DotScreenPass.js");
  const { AfterimagePass } =  await import(root+"AfterimagePass.js");

  const { FXAAPass } =  await import(root+"FXAAPass.js");
  const { SMAAPass } =  await import(root+"SMAAPass.js");
  const { SAOPass } =  await import(root+"SAOPass.js");
  const { GTAOPass } =  await import(root+"GTAOPass.js");
  const { TAARenderPass } =  await import(root+"TAARenderPass.js");
  const { SSAARenderPass } =  await import(root+"SSAARenderPass.js");
  
  //https://github.com/mrdoob/three.js/tree/dev/examples/jsm/postprocessing
  //https://github.com/pmndrs/postprocessing more effects

  const pmndrs = await import("https://esm.sh/postprocessing");


  const three = _ThreeJS_.three;
  const scene = _ThreeJS_.scene;
  let assets = _ThreeJS_.assets;
  let clock = _ThreeJS_.clock;

  let loopId, composer, outputPass;
  let camera = _ThreeJS_.camera;

  let effects = new Map();
  let onCameraChange = [];

  async function init() {

    composer = new EffectComposer( await three.renderer );
    
    const renderPass = new RenderPass( scene, camera );
    composer.addPass( renderPass );
    onCameraChange.push(renderPass);

    outputPass = new OutputPass();
    composer.addPass( outputPass );

    addEventListener("ThreeJS-Reset", ()=>{
      camera = _ThreeJS_.camera;
      onCameraChange.forEach(p=>p.camera = camera);
      console.log(composer);
    });
    addEventListener("ThreeJS-cameraChange", ()=>{
      camera = _ThreeJS_.camera;
      onCameraChange.forEach(p=>p.camera = camera);
    });
    addEventListener("ThreeJS-sizeChange", ()=>{
      composer.setSize(...three.skin._size);
    });
  }

  const render = () => {
    if (camera && scene) {
      //three.renderer.render(scene, camera);
      composer.render();

      three.skin.updateTexture();
      renderer.dirty = true;
    }

    const canvas = `${renderer.canvas.width}x${renderer.canvas.height}`;

    if (lastCanvas !== canvas) {
      lastCanvas = canvas;
      three.skin.updateSize();
    }
  };

  Promise.resolve(init())
    .then(() => {

      class ThreeJSAddon {
        getInfo() {
          return {
            id: extensionID,
            name: "Postprocessing",
            color1: "#4D5061",
            color2: "#30323D",
            color3: "#606060",
            menuIconURI: extensionIcon,
            blockIconURI: extensionIcon,
            docsURI: "https://github.com/Brackets-Coder/ThreeJS-Extension",
            blocks: [
              {
                opcode: "reset",
                blockType: "command",
                color1: "#C84630",
                text: "reset effects",
              },
              {
                opcode: "remove",
                blockType: "command",
                color1: "#C84630",
                text: "remove effect [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },

              "---",
              {blockType: "label",
              text: Scratch.translate("Anti-aliasing")},

              {
                opcode: "fxaa",
                blockType: "command",
                text: "add FXAA [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },
              {
                opcode: "smaa",
                blockType: "command",
                text: "add SMAA [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },
              {
                opcode: "sao",
                blockType: "command",
                text: "add SAO [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },
              {
                opcode: "gtao",
                blockType: "command",
                text: "add GTAO [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },
              {
                opcode: "taa",
                blockType: "command",
                text: "add TAA [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },
              {
                opcode: "ssaa",
                blockType: "command",
                text: "add SSAA [ID]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                }
              },

              "---",
              {blockType: "label",
              text: Scratch.translate("Light")},

              {
                opcode: "bloom",
                blockType: "command",
                text: "add bloom [ID] strength [S] kernelSize [K] sigma [M]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  S: {type: "number", defaultValue: 1},
                  K: {type: "number", defaultValue: 25},
                  M: {type: "number", defaultValue: 4},
                }
              },

              "---",
              {blockType: "label",
              text: Scratch.translate("Utilities")},

              {
                opcode: "halftone",
                blockType: "command",
                text: "add Halftone [ID] shape [S] radius [R] scatter [SC] opacity [B] blending [BM] greyscale [GS]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  S: {type: "number", menu: "halftoneShapes", defaultValue: "1"},
                  R: {type: "number", defaultValue: 1},
                  SC: {type: "number", defaultValue: 2},
                  GS: {type: "string", menu: "boolean", defaultValue: "false"},
                  B: {type: "number", defaultValue: 1},
                  BM: {type: "string", menu: "blending", defaultValue: "1"},
                }
              },
              {
                opcode: "setHalftone",
                blockType: "command",
                text: "set halftone [ID] [PROPERTY] to [V]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  PROPERTY: {type: "string", menu: "halftone"},
                  V: {type: "string", defaultValue: "10"},
                }
              },
              "---",
              {
                opcode: "outline",
                blockType: "command",
                text: "add outline [ID] objects [O]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  O: {type: "string", defaultValue: `["object","tree"]`},
                }
              },
              {
                opcode: "setOutline",
                blockType: "command",
                text: "set outline [ID] [PROPERTY] to [V]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  PROPERTY: {type: "string", menu: "outline"},
                  V: {type: "string", defaultValue: "10"},
                }
              },
              "---",
              {
                opcode: "afterimage",
                blockType: "command",
                text: "add afterimage [ID] damp [D]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  D: {type: "number", defaultValue: 0.8},
                }
              },

              "---",
              {blockType: "label",
              text: Scratch.translate("Fun & More")},

              {
                opcode: "film",
                blockType: "command",
                text: "add film [ID] intensity [I] grayscale [GS]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  I: {type: "number", defaultValue: 1},
                  GS: {type: "string", menu: "boolean"},
                }
              },
              {
                opcode: "glitch",
                blockType: "command",
                text: "add glitch [ID] displacement [D]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  D: {type: "number", defaultValue: 64},
                }
              },
              {
                opcode: "dot",
                blockType: "command",
                text: "add dotsceen [ID] center [C] angle [A] scale [S]",
                arguments: {
                  ID: {type: "string", defaultValue: "effect"},
                  C: {type: "string", defaultValue: "[0,0]"},
                  A: {type: "number", defaultValue: 0},
                  S: {type: "number", defaultValue: 0.8},
                }
              },
            ],
            menus: {
              boolean: { acceptReporters: true, items: ["true", "false"]},
              outline: {items: 
                [
                  { text: Scratch.translate("Edge Strength"), value: "edgeStrength" },
                  { text: Scratch.translate("Edge Thickness"), value: "edgeThickness" },
                  { text: Scratch.translate("Edge Glow"), value: "edgeGlow" },
                  { text: Scratch.translate("Pulse Period"), value: "pulsePeriod" },
                  { text: Scratch.translate("Downsample Ratio"), value: "downSampleRatio" },
                  
                  { text: Scratch.translate("Use Pattern Texture"), value: "usePatternTexture" },
                  { text: Scratch.translate("Visible"), value: "enabled" },

                  { text: Scratch.translate("Visible Edge Color"), value: "visibleEdgeColor" },
                  { text: Scratch.translate("Hidden Edge Color"), value: "hiddenEdgeColor" },
                  
                  { text: Scratch.translate("Selected Objects"), value: "selectedObjects" },
                  { text: Scratch.translate("Pattern Texture"), value: "patternTexture" }
                ]
              },
              halftone: {items: [
                { text: Scratch.translate("Shape"), value: "shape" },
                { text: Scratch.translate("Radius"), value: "radius" },
                { text: Scratch.translate("Rotate Red Chanel"), value: "rotateR" },
                { text: Scratch.translate("Rotate Blue Chanel"), value: "rotateB" },
                { text: Scratch.translate("Rotate Green Chanel"), value: "rotateG" },
                { text: Scratch.translate("Scatter"), value: "scatter" },
                { text: Scratch.translate("Opacity (blending)"), value: "blending" },
                { text: Scratch.translate("Blending Mode"), value: "blendingMode" },
                { text: Scratch.translate("Greyscale"), value: "greyscale" },
                { text: Scratch.translate("Disable"), value: "disable" }
              ]},
              blending: {items: [
                { text: Scratch.translate("Linear (0)"), value: "0" },
                { text: Scratch.translate("Multiply (1)"), value: "1" },
                { text: Scratch.translate("Additive (2)"), value: "2" },
                { text: Scratch.translate("Screen (3)"), value: "3" },
                { text: Scratch.translate("Overlay (4)"), value: "4" },
                { text: Scratch.translate("Lighten (5)"), value: "5" },
              ]},
              halftoneShapes: {items: [
                { text: Scratch.translate("Nothing (0)"), value: "0" },
                { text: Scratch.translate("Dot (1)"), value: "1" },
                { text: Scratch.translate("Ellipse (2)"), value: "2" },
                { text: Scratch.translate("Line (3)"), value: "3" },
                { text: Scratch.translate("Square (4)"), value: "4" },
              ]},
            },
          };
        }

        reset() {
          composer.passes = [];
          effects.clear();
          onCameraChange = [];

          const renderPass = new RenderPass( scene, camera );
          composer.addPass( renderPass );
          onCameraChange.push(renderPass);

          outputPass = new OutputPass();
          composer.addPass( outputPass );
        }
        addPass(pass, args) {
          composer.removePass(outputPass);
          
          if (effects.get(args.ID)) {composer.removePass(effects.get(args.ID)); console.warn(`Effect named ${args.ID} already exists, will replace!`);}
          effects.set(args.ID, pass);
          composer.addPass( pass );
          console.log(`Added effect pass ${args.ID}`, pass);

          outputPass = new OutputPass();
          composer.addPass( outputPass );
        }
        remove(args) {
          const e = effects.get(args.ID);
          if (!e) {console.warn(`Can't find effect named ${args.ID}`); return;}
          composer.removePass(e);
          delete effects.get(args.ID);
        }

        fxaa(args) {
          this.addPass(new FXAAPass(), args);
        }
        smaa(args) {
          this.addPass(new SMAAPass(), args);
        }
        sao(args) {
          const r = new THREE.Vector2(composer._width, composer._height);
          const pass = new SAOPass(scene, camera, r);
          pass.params.saoScale = 20;
          pass.params.saoIntensity = 0.1;
          pass.params.saoKernelRadius = 300;
          this.addPass(pass, args);
          onCameraChange.push(pass);
        }
        gtao(args) {
          const pass = new GTAOPass(scene, camera, composer._width, composer._height);
          this.addPass(pass, args);
          onCameraChange.push(pass);
        }
        taa(args) {
          //works, but... doesn't
          const pass = new TAARenderPass(scene, camera);
          pass.sampleLevel = 2;
          pass.accumulate = true;
          this.addPass(pass, args);
          onCameraChange.push(pass);
        }
        ssaa(args) {
          const pass = new SSAARenderPass(scene, camera);
          pass.sampleLevel = 2;
          this.addPass(pass, args);
          onCameraChange.push(pass);
        }

        bloom(args) {
          this.addPass(new BloomPass(args.S, args.K, args.M), args);
        }

        outline(args) {
          const r = new THREE.Vector2(composer._width, composer._height);
          let objects = [];
          try { args.O = JSON.parse(args.O);
            args.O.forEach(o=>{
              const obj = assets.objects.get(o);
              if (!obj) {console.warn(`Can't find object named ${o}`);}
              else objects.push(obj);
            });
          }
          catch {
            const obj = assets.objects.get(args.O);
            if (!obj) {console.warn(`Can't find object named ${args.O}`);}
            else objects.push(obj);
          }

          const pass = new OutlinePass(r, scene, camera);
          pass.selectedObjects = objects;
          this.addPass(pass, args);
          onCameraChange.forEach(p=>p.camera = camera);
        }
        setOutline(args) {
          const pass = effects.get(args.ID);
          if (!pass) {console.warn(`Can't find effect named ${args.ID}`); return;}

          if (args.PROPERTY == "selectedObjects") {
            let objects = [];
            try { args.V = JSON.parse(args.V);
              args.V.forEach(o=>{
                const obj = assets.objects.get(o);
                if (!obj) {console.warn(`Can't find object named ${o}`);}
                else objects.push(obj);
              });
            }
            catch {
              const obj = assets.objects.get(args.V);
              if (!obj) {console.warn(`Can't find object named ${args.V}`);}
              else objects.push(obj);
            }
            pass.selectedObjects = objects;
          }
          else if (args.PROPERTY == "patternTexture") {
            const texture = assets.textures.get(args.V);
              if (!texture) {console.warn(`Can't find texture named ${args.V}`);}
            pass.patternTexture = texture;
          }
          else if (args.PROPERTY.includes("Color")) {
            pass[args.PROPERTY] = new THREE.Color( args.V );
          }
          else pass[args.PROPERTY] = JSON.parse(args.V);
        }

        glitch(args) {
          this.addPass(new GlitchPass(args.D), args);
        }
        film(args) {
          this.addPass(new FilmPass(args.I, JSON.parse(args.GS)), args);
        }
        dot(args) {
          const c = new THREE.Vector2(...JSON.parse(args.C));
          this.addPass(new DotScreenPass(c, args.A, args.S), args);
        }

        halftone(args) {
          const params = {
            shape: JSON.parse(args.S),
            radius: args.R,
            rotateR: 0,
            rotateB: 0,
            rotateG: 0,
            scatter: args.SC,
            blending: args.B,
            blendingMode: JSON.parse(args.BM),
            greyscale: JSON.parse(args.GS),
            disable: false
          };
          const pass = new HalftonePass( params );
          this.addPass(pass, args);
        }
        setHalftone(args) {
          const pass = effects.get(args.ID);
          if (!pass) {console.warn(`Can't find effect named ${args.ID}`); return;}
        
          pass.uniforms[args.PROPERTY].value = JSON.parse(args.V);
        }

        afterimage(args) {
          this.addPass(new AfterimagePass(args.D), args);
        }

      }

      Scratch.extensions.register(new ThreeJSAddon());

      _ThreeJS_.stealedRender = true;
      _ThreeJS_.onRender.push(render);

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
