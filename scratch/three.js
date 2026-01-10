// Name: ThreeJS
// ID: turboThree
// Description: Blocks for creating and manipulating 3D objects using the Three.js library. (insert better description here).
// By: Civero <https://scratch.mit.edu/users/Civero/>
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// By: Drago-Cuven <https://scratch.mit.edu/users/DragoCuven/>
// By: Astruegenius <https://scratch.mit.edu/users/Astruegenius/>
// License: MPL-2.0 and MIT

// Started collaboratively 23 December 2025

(async function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("This three.js extension must run unsandboxed");
  }

  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const runtime = vm.runtime;

  let width, height;
  let lastCanvas;

  //const THREE = await Scratch.external.importModule("https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js");
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js");
  // const THREE = await import("https://esm.sh/three@0.180.0");

  let three, loopId, clock;
  let rawBuffer, gpuView, renderData;
  let scene, camera; //just for now (so the loop has them), can change later to an object or whatever - Civ

  let objects = new Map();

  const setupThree = () => {
    const renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,
      antialias: true,
      alpha: true,
    });
    const context = renderer.getContext();

    return { renderer, context };
  };

  const setupSkin = () => {

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

        this.onNativeSizeChanged();
      }

      getTexture() {
        return this._texture;
      }

      updateTexture(data) {
        const gl = this._renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._texture);

        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          width,
          height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data
        );
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        this.emitWasAltered();
      }

      updateSize() {
        if (renderer.useHighQualityRender) {
          width = renderer.canvas.width;
          height = renderer.canvas.height;
        } else {
          [width, height] = this._nativeSize;
        }

        this._size = [width, height];

        three.renderer.setSize(width, height);

        rawBuffer = new ArrayBuffer(
          width * height * 4,
        );
        gpuView = new Uint8Array(rawBuffer);
        renderData = new ImageData(
          new Uint8ClampedArray(rawBuffer),
          width,
          height
        );

        if (camera) {
          const [width, height] = this._nativeSize;
          if (camera.isPerspectiveCamera) {
            camera.aspect = width / height;
          } else {
            camera.top = height / 50;
            camera.bottom = height / -50;
            camera.right = width / 50;
            camera.left = width / -50;
          }
          camera.updateProjectionMatrix();
        }

        const gl = this._renderer.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );

        this.emitWasAltered();
      }

      onNativeSizeChanged() {
        this._nativeSize = renderer.getNativeSize();
        this._rotationCenter = [this._nativeSize[0] / 2, this._nativeSize[1] / 2];
        this.updateSize();
      }

      get size() {
        return this._nativeSize;
      }
      
      dispose() {
        if (this._texture) {
          this._renderer.gl.deleteTexture(this._texture);
          this._texture = null;
        }
        super.dispose();
      }
    }

    three.skin = new ThreeSkin();
    renderer._allSkins[three.skin.id] = three.skin;
    const threeDrawableId = renderer.createDrawable("pen");
    renderer.updateDrawableSkinId(threeDrawableId, three.skin.id);
    renderer._allDrawables[threeDrawableId].customDrawableName = "Three Layer";
  };

  function init() {
    three = setupThree();
    setupSkin();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(90, width/height);
    clock = new THREE.Clock();

    window._ThreeJS_ = {
      THREE: THREE,
      get three() {
        return three;
      },
    };

    runtime.on("STAGE_SIZE_CHANGED", () =>
      requestAnimationFrame(() => three.skin.onNativeSizeChanged()),
    );

    runtime.on("PROJECT_START", () => {
      loopId = requestAnimationFrame(loop);
    });

    runtime.on("PROJECT_STOP_ALL", () => {
      if (loopId) {
        cancelAnimationFrame(loopId);
        loopId = null;
      }
    });

    const originalHQP = Scratch.vm.renderer.setUseHighQualityRender;
    Scratch.vm.renderer.setUseHighQualityRender = function(state) {
      originalHQP.call(Scratch.vm.renderer, state);
      
      console.log("HQP toggled!");
    };

    loop(); //autostart? Not working every the time... why? - Civ
  }

  const loop = () => {
    loopId = requestAnimationFrame(loop);

    const delta = clock.getDelta();

    if (camera && scene) {
      //animation (delete)
      camera.position.z = Math.abs(Math.sin(clock.elapsedTime * 1)) * 5 + 5;

      three.renderer.render(scene, camera);

      three.context.readPixels(
        0,
        0,
        width,
        height,
        three.context.RGBA,
        three.context.UNSIGNED_BYTE,
        gpuView,
      );
      three.skin.updateTexture(renderData);
      renderer.dirty = true;
    }

    const canvas = `${renderer.canvas.width}x${renderer.canvas.height}`;

    if (lastCanvas !== canvas) {
      lastCanvas = canvas;
      three.skin.updateSize();
      console.log(canvas);
    }
  
  };

  Promise.resolve(init())
    .then(() => {

      //toughts on this? To have each section better organized. - civ
      const coreBlocks = [
        {
          blockType: "label",
          text: Scratch.translate("Core"),
        },
        {
          opcode: "placeholder",
          blockType: "command",
          text: Scratch.translate("set scene [PROPERTY] to [VALUE]"),
          color1: "#f67f67",
          arguments: {
            PROPERTY: {type: "string", menu: "sceneProperties"},
            VALUE: {type: "string", defaultValue: "#9966ff"}
          }
        },
      ];

      class ThreeJS {

        constructor () {
          this.showCategory = {
            transformations: false,
            test: false,
            objects: false,
            camera: false,
          };

          this.reset = () => {
            if (Scratch.vm.extensionManager) {
              Scratch.vm.extensionManager.refreshBlocks();
            }
          };
        }

        getInfo() {
          return {
            id: "turboJS",
            name: Scratch.translate("ThreeJS"),
            color1: "#369369",
            color2: "#ffffff",
            color3: "#505050ff",
            blockIconURI: "data:image/png;base64,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",
            menuIconURI: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjI3IiBoZWlnaHQ9IjIyNyIgdmlld0JveD0iMCAwIDIyNyAyMjciIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8xXzIpIj4KPGNpcmNsZSBjeD0iMTEyLjUiIGN5PSIxMTMuNSIgcj0iMTEzLjUiIGZpbGw9IiNEOUQ5RDkiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik04OS4xMjA2IDE5MC4wODNMNTYgNTZMMTg4Ljc3MiA5NC4yMjU5TDg5LjEyMDYgMTkwLjA4M1oiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTIyLjM2MSA3NS4xMTY4TDEzOC45MSAxNDIuMTc4TDcyLjU2MDcgMTIzLjA1OUwxMjIuMzYxIDc1LjExNjhaIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEwNS44OTggMTMyLjE1NEw5Ny42Nzg3IDk4Ljg0MDdMMTMwLjY0MiAxMDguMzAzTDEwNS44OTggMTMyLjE1NFoiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNODkuNDU2MyA2NS41Njc2TDk3LjY3NTcgOTguODgxM0w2NC43MTIyIDg5LjQxODdMODkuNDU2MyA2NS41Njc2WiIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNTUuMzggODQuNTU3OUwxNjMuNTk5IDExNy44NzJMMTMwLjYzNiAxMDguNDA5TDE1NS4zOCA4NC41NTc5WiIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMDUuOTAyIDEzMi4xNzdMMTE0LjEyMSAxNjUuNDkxTDgxLjE1NzkgMTU2LjAyOUwxMDUuOTAyIDEzMi4xNzdaIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzFfMiI+CjxyZWN0IHdpZHRoPSIyMjYuNzciIGhlaWdodD0iMjI2Ljc3IiBmaWxsPSJ3aGl0ZSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPgo=",
            blocks: [

              ...coreBlocks,              
              {
                blockType: Scratch.BlockType.BUTTON,
                text: this.showCategory.transformations ? Scratch.translate("Hide Transformation Blocks") : Scratch.translate("Show Transformation Blocks"),
                func: "toggleTransform",
              },
              {
                opcode: "getTransform",
                text: "get [XYZ] [TRANFORM] of object [OBJECT]",
                blockType: Scratch.BlockType.REPORTER,
                hideFromPalette: !this.showCategory.transformations,
                arguments: {
                  XYZ: { type: Scratch.ArgumentType.STRING, menu: "XYZ" },
                  TRANFORM: { type: Scratch.ArgumentType.STRING, menu: "transformType" },
                  OBJECT: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                },
              },
              {
                blockType: Scratch.BlockType.BUTTON,
                text: this.showCategory.test ? Scratch.translate("Hide Test Blocks") : Scratch.translate("Show Test Blocks"),
                func: "toggleCore",
              },
              {
                opcode: "renderer",
                blockType: Scratch.BlockType.COMMAND,
                text: "set renderer [PROPERTY] to [VALUE]",
                hideFromPalette: !this.showCategory.test,
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "rendererProperties" },
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "false" },
                },
              },
              {
                opcode: "createMesh",
                blockType: Scratch.BlockType.COMMAND,
                text: "create mesh named [NAME] with geometry [GEOMETRY] and material [MATERIAL]",
                hideFromPalette: !this.showCategory.test,
                arguments: {
                  GEOMETRY: { type: Scratch.ArgumentType.STRING },
                  MATERIAL: { type: Scratch.ArgumentType.STRING },
                  NAME: { type: Scratch.ArgumentType.STRING },
                },
              },
              {
                blockType: Scratch.BlockType.BUTTON,
                text: this.showCategory.objects ? Scratch.translate("Hide Object Blocks") : Scratch.translate("Show Object Blocks"),
                func: "toggleObj",
              },
              {
                opcode: "addObject",
                blockType: Scratch.BlockType.COMMAND,
                text: "add [TYPE] named [NAME] to [PARENT]",
                hideFromPalette: !this.showCategory.objects,
                color1: "#22bbaa",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "objectType" },
                  INFO: { type: Scratch.ArgumentType.STRING, defaultValue: "object data name" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  PARENT: { type: Scratch.ArgumentType.STRING, defaultValue: "scene" },
                },
              },
              {
                opcode: "objectExists",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "object [NAME] exists",
                hideFromPalette: !this.showCategory.objects,
                color1: "#22bbaa",
                arguments: {
                    NAME: { type: Scratch.ArgumentType.STRING},
                }
              },
              {
                blockType: Scratch.BlockType.BUTTON,
                text: this.showCategory.camera ? Scratch.translate("Hide Camera Blocks") : Scratch.translate("Show Camera Blocks"),
                func: "toggleCam",
              },
              {
                opcode: "setRenderingCamera",
                blockType: Scratch.BlockType.COMMAND,
                text: "set rendering camera [NAME] ",
                hideFromPalette: !this.showCategory.camera,
                color1: "#5555bb",
                arguments: {
                    NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "camera" },
                }
              },
              {
                blockType: "label",
                text: "block for switching ortho/perspective here",
                hideFromPalette: !this.showCategory.camera,
              },
            ],

            // * Menus should be translated as necessary. See below for examples — Brackets
            menus: {
              
              XYZ: { items: ["x", "y", "z"] },

              transformType: {
                items: [
                  {
                    text: Scratch.translate("position"),
                    value: "position",
                  },
                  {
                    text: Scratch.translate("rotation"),
                    value: "rotation",
                  },
                  {
                    text: Scratch.translate("scale"),
                    value: "scale",
                  },
                ]
              },

              objectType: {
                items: [
                  {
                    text: Scratch.translate("Mesh"),
                    value: "Mesh",
                  },
                  {
                    text: Scratch.translate("Perspective Camera"),
                    value: "PerspectiveCamera"
                  },
                  {
                    text: Scratch.translate("Orthographic Camera"),
                    value: "OrthographicCamera"
                  },
                  {
                    text: Scratch.translate("Sprite"),
                    value: "Sprite",
                  },
                  {
                    text: Scratch.translate("Group"),
                    value: "Group",
                  },
                  {
                    text: Scratch.translate("Points"),
                    value: "Points",
                  },
                  {
                    text: Scratch.translate("Lines"),
                    value: "Lines",
                  },
                  {
                    text: Scratch.translate("Point Light"),
                    value: "PointLight",
                  },
                  {
                    text: Scratch.translate("Directional Light"),
                    value: "DirectionalLight",
                  },
                  {
                    text: Scratch.translate("more!"),
                    value: "more!",
                  },
                ]
              },
              rendererProperties: { items: ["autoClear", "autoClearColor", "autoClearDepth"] },
              sceneProperties: {items: [
                {
                  text: Scratch.translate("background"),
                  value: "background"
                }
              ]}
            },

          };
        }

        toggleTransform() {
          this.showCategory.transformations = !this.showCategory.transformations;
          this.reset();
        }

        toggleCore() {
          this.showCategory.test = !this.showCategory.test;
          this.reset();
        }

        toggleObj() {
          this.showCategory.objects = !this.showCategory.objects;
          this.reset();
        }

        toggleCam() {
          this.showCategory.camera = !this.showCategory.camera;
          this.reset();
        }

        placeholder(args) {
          scene.background = new THREE.Color(args.VALUE);
        }

        renderer(args) {
          three.renderer[args.PROPERTY] = JSON.parse(args.VALUE); // is there a better way than .parse? - Civ
        }

        getTransform({ XYZ, TRANSFORM, OBJECT }) {
          if (objects.get(OBJECT))
            return objects?.get(OBJECT)[TRANSFORM][XYZ];
        }

        createMesh(args){
          //* is this supposed to be objects.get(args.GEOMETRY) instead of get(GEOMETRY)? I updated it for you. - Brackets
          //im unsure about this block. we can create an empty mesh with addObject(). Then assign a material and a geometry to it. - Civero
          objects.set(args.NAME, new THREE.Mesh(objects.get(args.GEOMETRY), objects.get(args.MATERIAL)));
        }

        addObject(args) {
          const obj = new THREE[args.TYPE]();

          switch (args.TYPE) {
            case "PerspectiveCamera": 
              obj.aspect = width / height;
              obj.updateProjectionMatrix();
              break;
            case "OrthographicCamera":
              const [w, h] = three.skin._nativeSize;
              obj.top = h / 50;
              obj.bottom = h / -50;
              obj.right = w / 50;
              obj.left = w / -50;
              obj.updateProjectionMatrix();
              break;
            case "Mesh":
              obj.material = new THREE.MeshNormalMaterial();
              obj.geometry = new THREE.TorusKnotGeometry();
              break;
          }

          objects.set(args.NAME, obj);
          const parent = objects.get(args.PARENT);

          if (args.PARENT == "scene") {
            scene.add(obj);
            return;
          } else if (!parent) { //should search in another map for scenes with that name (future) - Civ
            console.error(`No object named "${args.PARENT}". Adding to scene.`);
            scene.add(obj);
            return;
          }

          parent.add(obj);
        }

        objectExists(args){
          if(objects.get(args.NAME)) return true; 
          else return false;
        }

        setRenderingCamera(args){
          const selected = objects.get(args.NAME);
          if (!selected) {
            console.error(`No object named "${args.NAME}"`);
            return;
          }
          camera = selected;
        }

      }

      Scratch.extensions.register(new ThreeJS());

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
