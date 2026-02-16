// Name: ThreeJS
// ID: turboThree
// Description: Blocks for creating and manipulating 3D objects using the Three.js library. (insert better description here).
// By: Civero <https://scratch.mit.edu/users/Civero/>
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// By: Drago-Cuven <https://scratch.mit.edu/users/DragoCuven/>
// By: Astruegenius <https://scratch.mit.edu/users/Astruegenius/>
// License: MPL-2.0 and MIT

// Started collaboratively 23 December 2025
// Unactive around January 8th
// Civero resumed progress around February 10th

(async function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("Three.js must run unsandboxed");
  }

  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const runtime = vm.runtime;

  let width, height;
  let lastCanvas;

  //const THREE = await Scratch.external.importModule("https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js");
  const THREE = await import("https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js");
  // const THREE = await import("https://esm.sh/three@0.180.0");

  let three, loopId, clock, defaultGeo, defaultMat;
  let rawBuffer, gpuView, renderData;
  let scene, camera;

  let assets = {
    objects: new Map(),
    geometries: new Map(),
    materials: new Map(),
    textures: new Map(),
  };

  const RadiansMultiplier = Math.PI/180;

  const setupThree = () => {
    const renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,
      antialias: true,
      alpha: true,
    });
    const context = renderer.getContext();
    const textureLoader = new THREE.TextureLoader();

    return { renderer, context, textureLoader };
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
    renderer._allDrawables[threeDrawableId].updateScale([100,-100]); //Y flip
  };

  async function init() {
    three = setupThree();
    setupSkin();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(90, width/height);
    camera.position.z = 2;
    assets.objects.set("camera", camera);
    clock = new THREE.Clock();

    defaultGeo = new THREE.BoxGeometry();
    defaultMat = new THREE.MeshBasicMaterial();
    defaultMat.map = await three.textureLoader.loadAsync('data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIyOTciIGhlaWdodD0iMjk3IiB2aWV3Qm94PSIwLDAsMjk3LDI5NyI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTkxLjUsLTMxLjUpIj48ZyBzdHJva2U9Im5vbmUiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCI+PHBhdGggZD0iTTM4OC41LDMxLjVsMCwyOTdsLTI5NywwbDAsLTI5N3oiIGZpbGw9IiM2NjY2NjYiIHN0cm9rZS13aWR0aD0iMCIvPjxwYXRoIGQ9Ik05MS41LDMyOC41di0xNDguNWgxNDguNXYxNDguNXoiIGZpbGw9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMCIvPjxwYXRoIGQ9Ik0yNDAsMTgwdi0xNDguNWgxNDguNXYxNDguNXoiIGZpbGw9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMCIvPjx0ZXh0IHRyYW5zZm9ybT0idHJhbnNsYXRlKDEwMy45OTEyMSwzMDMuODIxNTYpIHNjYWxlKDEuMjIwMTksMS4yMjAxOSkiIGZvbnQtc2l6ZT0iNDAiIHhtbDpzcGFjZT0icHJlc2VydmUiIGZpbGw9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMSIgZm9udC1mYW1pbHk9IlNlcmlmIiBmb250LXdlaWdodD0ibm9ybWFsIiB0ZXh0LWFuY2hvcj0ic3RhcnQiPjx0c3BhbiB4PSIwIiBkeT0iMCI+bm8gbWF0ZXJpYWw8L3RzcGFuPjwvdGV4dD48dGV4dCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzNzYuMDA5MDgsNTYuMTc4MzgpIHJvdGF0ZSgtMTgwKSBzY2FsZSgxLjIyMDIsMS4yMjAyKSIgZm9udC1zaXplPSI0MCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgZmlsbD0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIxIiBmb250LWZhbWlseT0iU2VyaWYiIGZvbnQtd2VpZ2h0PSJub3JtYWwiIHRleHQtYW5jaG9yPSJzdGFydCI+PHRzcGFuIHg9IjAiIGR5PSIwIj5ubyBtYXRlcmlhbDwvdHNwYW4+PC90ZXh0PjwvZz48L2c+PC9zdmc+');
    defaultMat.map.colorSpace = "srgb";

    window._ThreeJS_ = {
      THREE: THREE,
      get three() {
        return three;
      },
      get scene() {
        return scene;
      },
      get camera() {
        return camera;
      },
      get assets() {
        return assets;
      },
      get clock() {
        return clock;
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
    };
  }

  const render = () => {
    if (camera && scene) {
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
    }
  };

  const loop = () => {
    loopId = requestAnimationFrame(loop);

    const delta = clock.getDelta();

    render();
  };

  Promise.resolve(init())
    .then(() => {

      class ThreeJS {
        getInfo() {
          return {
            id: "turboJScivmod",
            name: "ThreeJS",
            color1: "#4D5061",
            color2: "#30323D",
            color3: "#606060",
            menuIconURI: "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIyMTQiIGhlaWdodD0iMjE0IiB2aWV3Qm94PSIwLDAsMjE0LDIxNCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEzMywtNzMpIj48ZyBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiPjxwYXRoIGQ9Ik0xMzMsMTgwYzAsLTU5LjA5NDQ3IDQ3LjkwNTUzLC0xMDcgMTA3LC0xMDdjNTkuMDk0NDcsMCAxMDcsNDcuOTA1NTMgMTA3LDEwN2MwLDU5LjA5NDQ3IC00Ny45MDU1MywxMDcgLTEwNywxMDdjLTU5LjA5NDQ3LDAgLTEwNywtNDcuOTA1NTMgLTEwNywtMTA3eiIgZmlsbD0iIzE5MTkxOSIgZmlsbC1ydWxlPSJub256ZXJvIiBzdHJva2U9IiM1Y2Q0OTgiIHN0cm9rZS13aWR0aD0iMCIgc3Ryb2tlLWxpbmVqb2luPSJtaXRlciIvPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMTEuNTk4LDI4MC40N2wtNDMuMjEzLC0xNzQuOTRsMTczLjIzLDQ5Ljg3NHoiLz48cGF0aCBkPSJNMjU0Ljk2OCwxMzAuNDcybDIxLjU5MSw4Ny40OTZsLTg2LjU2NywtMjQuOTQ1eiIvPjxwYXRoIGQ9Ik0yMzMuNDg4LDIwNC44OWwtMTAuNzI0LC00My40NjVsNDMuMDA4LDEyLjM0NnoiLz48cGF0aCBkPSJNMjEyLjAzNiwxMTguMDEzbDEwLjcyNCw0My40NjVsLTQzLjAwOCwtMTIuMzQ2eiIvPjxwYXRoIGQ9Ik0yOTguMDQ4LDE0Mi43OWwxMC43MjQsNDMuNDY1bC00My4wMDgsLTEyLjM0NnoiLz48cGF0aCBkPSJNMjMzLjQ5MywyMDQuOTJsMTAuNzI0LDQzLjQ2NWwtNDMuMDA4LC0xMi4zNDZ6Ii8+PC9nPjwvZz48L2c+PC9zdmc+",
            docsURI: "https://civ3ro.github.io",
            blocks: [

              {
                blockType: "button",
                text: Scratch.translate("Open Three.js Documentation"),
                func: "openExtra" 
              },

              {
                opcode: "reset",
                blockType: Scratch.BlockType.COMMAND,
                text: "reset [VALUE]",
                arguments: {
                  VALUE: { type: Scratch.ArgumentType.STRING, menu: "reset" },
                },
              },
              {
                opcode: "stats",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [VALUE]",
                disableMonitor: true,
                arguments: {
                  VALUE: { type: Scratch.ArgumentType.STRING, menu: "stats" },
                },
              },

              "---",

              {
                opcode: "renderer",
                blockType: Scratch.BlockType.COMMAND,
                text: "set renderer [PROPERTY] to [VALUE]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "rendererProperties" },
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "false" },
                },
              },

              {
                opcode: "rendererClear",
                blockType: Scratch.BlockType.COMMAND,
                text: "clear renderer [B]",
                arguments: {
                  B: { type: Scratch.ArgumentType.STRING, menu: "clearBuffers" },
                },
              },

              "---",

              {
                opcode: "scene",
                blockType: Scratch.BlockType.COMMAND,
                text: "set scene [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "sceneProperties" },
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "#222222" },
                },
              },

              "---",

              {
                opcode: "deleteAsset",
                blockType: Scratch.BlockType.COMMAND,
                text: "delete [TYPE] named [NAME]",
                color1: "#694D7C",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "assetType" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                },
              },

              "---",
              {blockType: "label",
              text: Scratch.translate("Objects")},

              {
                opcode: "addObject",
                blockType: Scratch.BlockType.COMMAND,
                text: "add [TYPE] named [NAME] to [PARENT]",
                color1: "#5FAD56",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "objectType" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  PARENT: { type: Scratch.ArgumentType.STRING, defaultValue: "scene" },
                },
              },
              {
                opcode: "objectExists",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "object [NAME] exists",
                color1: "#5FAD56",
                arguments: {
                    NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object"},
                }
              },
              {
                opcode: "setObject",
                blockType: Scratch.BlockType.COMMAND,
                text: "set mesh [NAME] [PROPERTY] to [DATA]",
                color1: "#5FAD56",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "meshProperties", defaultValue: "material" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },

              "---",

              {
                opcode: "setTransform",
                blockType: "command",
                text: "set [TRANSFORM] of [OBJECT] to [VALUE]",
                color1: "#5C80BC",
                arguments: {
                  TRANSFORM: { type: Scratch.ArgumentType.STRING, menu: "transformType" },
                  OBJECT: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  VALUE: { type: "string", defaultValue: "[0,0,0]" },
                },
              },
              {
                opcode: "setRotation",
                blockType: "command",
                text: "set rotation order of [OBJECT] to [ORDER]",
                color1: "#5C80BC",
                arguments: {
                  OBJECT: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  ORDER: { type: "string", menu: "XYZorder"}
                },
              },
              {
                opcode: "transformTransform",
                blockType: "command",
                text: "for object [OBJECT] [ACTION] [XYZ] [TRANSFORM] to [VALUE]",
                color1: "#5C80BC",
                arguments: {
                  ACTION: { type: "string", menu: "actionModifier"},
                  XYZ: { type: Scratch.ArgumentType.STRING, menu: "XYZ" },
                  TRANSFORM: { type: Scratch.ArgumentType.STRING, menu: "transformType" },
                  OBJECT: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  VALUE: { type: "number", defaultValue: "1" },
                },
              },
              {
                opcode: "getTransform",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [TRANSFORM] of object [OBJECT]",
                color1: "#5C80BC",
                arguments: {
                  TRANSFORM: { type: Scratch.ArgumentType.STRING, menu: "transformType" },
                  OBJECT: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                },
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Vectors")},

              {
                opcode: "vector2",
                blockType: Scratch.BlockType.REPORTER,
                text: "vector2 [X] [Y]",
                color1: "#5C80BC",
                arguments: {
                  X: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1" },
                  Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: "2" },
                },
              },
              {
                opcode: "vector3",
                blockType: Scratch.BlockType.REPORTER,
                text: "vector3 [X] [Y] [Z]",
                color1: "#5C80BC",
                arguments: {
                  X: { type: Scratch.ArgumentType.NUMBER, defaultValue: "3" },
                  Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1" },
                  Z: { type: Scratch.ArgumentType.NUMBER, defaultValue: "2" },
                },
              },
              {
                opcode: "getAxis",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [XYZ] of [V3]",
                color1: "#5C80BC",
                arguments: {
                  XYZ: { type: Scratch.ArgumentType.STRING, menu: "XYZ" },
                  V3: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,2]" },
                },
              },
              {
                opcode: "operateVector",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [OPERATION] of [V]",
                color1: "#5C80BC",
                arguments: {
                  OPERATION: { type: Scratch.ArgumentType.STRING, menu: "vectorOperations" },
                  V: { type: Scratch.ArgumentType.STRING, defaultValue: "[1,2,3]" },
                },
              },
              {
                opcode: "operate2Vector",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [V1] [OPERATION] [V2]",
                color1: "#5C80BC",
                arguments: {
                  OPERATION: { type: Scratch.ArgumentType.STRING, menu: "vector2Operations" },
                  V1: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]" },
                  V2: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,2]" },
                },
              },
              {
                opcode: "directionToVector",
                blockType: Scratch.BlockType.REPORTER,
                text: "direction from [V1] to [V2]",
                color1: "#5C80BC",
                arguments: {
                  V1: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]" },
                  V2: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,2]" },
                },
              },
              {
                opcode: "interpolateVectors",
                blockType: Scratch.BlockType.REPORTER,
                text: "interpolation of [V1] to [V2] at [A]%",
                color1: "#5C80BC",
                arguments: {
                  A: { type: "number", defaultValue: "50" },
                  V1: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]" },
                  V2: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,2]" },
                },
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Geometries")},

              {
                opcode: "createGeometry",
                blockType: Scratch.BlockType.COMMAND,
                text: "create [TYPE] geometry named [NAME]",
                color1: "#C84630",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "geometryType", defaultValue: "BoxGeometry" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "cube" },
                },
              },
              {
                opcode: "setGeometry",
                blockType: Scratch.BlockType.COMMAND,
                text: "set geometry [NAME] [PROPERTY] to [DATA]",
                color1: "#C84630",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "geometryProperties", defaultValue: "position"},
                  DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "[-1,-1,0] [-1,1,0] [1,-1,0]"}, // how would we divide it? an array with v3 arrays? (better visual) or, separated: 0,0,0,0,1,0,1,0,0 - civ
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "cube" },
                },
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Materials")},

              {
                opcode: "createMaterial",
                blockType: Scratch.BlockType.COMMAND,
                text: "create [TYPE] material named [NAME]",
                color1: "#694D7C",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "materialType" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              {
                opcode: "setColorMaterial",
                blockType: Scratch.BlockType.COMMAND,
                text: "set material [NAME] [PROPERTY] to [DATA]",
                color1: "#694D7C",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "materialColorProperties"},
                  DATA: { type: Scratch.ArgumentType.COLOR, defaultValue: "#ff0000"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              {
                opcode: "setMapMaterial",
                blockType: Scratch.BlockType.COMMAND,
                text: "set material [NAME] [PROPERTY] to [DATA]",
                color1: "#694D7C",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "materialMapProperties"},
                  DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "sky"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              {
                opcode: "setMaterial",
                blockType: Scratch.BlockType.COMMAND,
                text: "set material [NAME] [PROPERTY] to [DATA]",
                color1: "#694D7C",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "materialNumeralProperties"},
                  DATA: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              {
                opcode: "setBoolMaterial",
                blockType: Scratch.BlockType.COMMAND,
                text: "set material [NAME] [PROPERTY] to [DATA]",
                color1: "#694D7C",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "materialBooleanProperties"},
                  DATA: { type: Scratch.ArgumentType.STRING, menu: "boolean"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              


              "---",

              {
                opcode: "loadTexture",
                blockType: Scratch.BlockType.COMMAND,
                text: "load texture from [COSTUME] as [NAME]",
                color1: "#694D7C",
                arguments: {
                  COSTUME: { type: Scratch.ArgumentType.COSTUME},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "sky"},
                },
              },
              {
                opcode: "setTexture",
                blockType: "command",
                text: "set texture [NAME] [PROPERTY] to [VALUE]",
                color1: "#694D7C",
                arguments: {
                  NAME: { type: "string", defaultValue: "sky"},
                  PROPERTY: { type: "string", menu: "textureProperties"},
                  VALUE: { type: "string", defaultValue: "[1,1]"},
                }
              },
              {
                opcode: "setTextureWrap",
                blockType: "command",
                text: "set texture [NAME] wrap U [U] V [V]",
                color1: "#694D7C",
                arguments: {
                  NAME: { type: "string", defaultValue: "sky"},
                  U: { type: "string", menu: "textureWarp"},
                  V: { type: "string", menu: "textureWarp"},
                }
              },
              {
                opcode: "setTextureFilter",
                blockType: "command",
                text: "set texture [NAME] filter mag [MAG] min [MIN]",
                color1: "#694D7C",
                arguments: {
                  NAME: { type: "string", defaultValue: "sky"},
                  MAG: { type: "string", menu: "magFilter"},
                  MIN: { type: "string", menu: "minFilter"},
                }
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Camera")},

              {
                opcode: "camera",
                blockType: Scratch.BlockType.REPORTER,
                text: "rendering camera",
                color1: "#5FAD56",
              },

              {
                opcode: "setCamera",
                blockType: Scratch.BlockType.COMMAND,
                text: "set camera [NAME] [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "camera" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "cameraProperties"},
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "90"},
                }
              },

              {
                opcode: "setRenderingCamera",
                blockType: Scratch.BlockType.COMMAND,
                text: "set rendering camera to [NAME]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "camera" },
                }
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Lights")},

              {
                opcode: "setLight",
                blockType: Scratch.BlockType.COMMAND,
                text: "for light [NAME] set [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "light"},
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "#ffaa00"},
                }
              },
              {
                opcode: "setPointLight",
                blockType: Scratch.BlockType.COMMAND,
                text: "for point or spot light [NAME] set [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "pointLight", defaultValue: "distance"},
                  VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: "0"},
                }
              },
              {
                opcode: "setTargetLight",
                blockType: Scratch.BlockType.COMMAND,
                text: "for spot or directional light [NAME] target to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},
                }
              },
              {
                opcode: "setSpotLight",
                blockType: Scratch.BlockType.COMMAND,
                text: "for spot light [NAME] set [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "spotLight", defaultValue: "penumbra"},
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "0.5"},
                }
              },
              {
                opcode: "setHemisphereLight",
                blockType: Scratch.BlockType.COMMAND,
                text: "for hemisphere light [NAME] set [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "hemisphereLight"},
                  VALUE: { type: Scratch.ArgumentType.COLOR, defaultValue: "#00aaff"},
                }
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Audio")},

              "---",

              {blockType: "label",
              text: Scratch.translate("Sensoring (separate future extension)")},

              {
                opcode: "touching",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "is object [A] touching object [B] [MODE]?",
                color1: "#5FAD56",
                arguments: {
                  A: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  B: { type: Scratch.ArgumentType.STRING, defaultValue: "ground"},
                  MODE: { type: Scratch.ArgumentType.STRING, defaultValue: "Box"},
                }
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("VR (separate future extension)")},
            ],
            menus: {
              
              XYZ: { items: ["x", "y", "z"] },
              XYZorder: { acceptReporters: true, items: ["XYZ", "YXZ", "XZY", "ZYX", "YZX", "ZXY"] },
              actionModifier: { items: [
                {text: Scratch.translate("set"), value: "set"},
                {text: Scratch.translate("change"), value: "change"},
              ]},
              boolean: { acceptReporters: true, items: ["true", "false"]},
              vectorOperations: { items: [
                { text: Scratch.translate("Floor"), value: "floor" },
                { text: Scratch.translate("Ceiling"), value: "ceil" },
                { text: Scratch.translate("Round"), value: "round" },
                { text: Scratch.translate("Round To Zero"), value: "roundToZero" },
                { text: Scratch.translate("Negate"), value: "negate" },
                { text: Scratch.translate("Length Sq"), value: "lengthSq" },
                { text: Scratch.translate("Length"), value: "length" },
                { text: Scratch.translate("Manhattan Length"), value: "manhattanLength" },
                { text: Scratch.translate("Normalize"), value: "normalize" },
                { text: Scratch.translate("Random"), value: "random" },
              ]},
              vector2Operations: { items: [
                { text: Scratch.translate("+"), value: "add" },
                { text: Scratch.translate("+ Scalar"), value: "addScalar" },
                { text: Scratch.translate("-"), value: "sub" },
                { text: Scratch.translate("- Scalar"), value: "subScalar" },
                { text: Scratch.translate("*"), value: "multiply" },
                { text: Scratch.translate("* Scalar"), value: "multiplyScalar" },
                { text: Scratch.translate("/"), value: "divide" },
                { text: Scratch.translate("/ Scalar"), value: "divideScalar" },
                { text: Scratch.translate("="), value: "equals" },
                { text: Scratch.translate("Distance To"), value: "distanceTo" },
                { text: Scratch.translate("Distance To Squared"), value: "distanceToSquared" },
                { text: Scratch.translate("Manhattan Distance To"), value: "manhattanDistanceTo" },
                { text: Scratch.translate("Angle To"), value: "angleTo" },
                { text: Scratch.translate("Cross"), value: "cross" },
                { text: Scratch.translate("Dot"), value: "dot" },
                { text: Scratch.translate("Min"), value: "min" },
                { text: Scratch.translate("Max"), value: "max" },
                { text: Scratch.translate("Project On Vector"), value: "projectOnVector" },
                { text: Scratch.translate("Project On Plane"), value: "projectOnPlane" },
                { text: Scratch.translate("Reflect"), value: "reflect" }
              ]},
              assetType: { items: [
                {text: Scratch.translate("object"), value: "objects"},
                {text: Scratch.translate("geometry"), value: "geometries"},
                {text: Scratch.translate("material"), value: "materials"},
                {text: Scratch.translate("texture"), value: "textures"},
              ]},
              transformType: {
                items: [
                  {text: Scratch.translate("position"), value: "position"},
                  {text: Scratch.translate("rotation"), value: "rotation"},
                  {text: Scratch.translate("scale"), value: "scale"},
                ]
              },
              objectType: {
                items: [
                  {text: Scratch.translate("Mesh"), value: "Mesh"},
                  {text: Scratch.translate("Sprite"), value: "Sprite"},
                  {text: Scratch.translate("Points"), value: "Points"},
                  {text: Scratch.translate("Lines"), value: "Lines"},
                  {text: Scratch.translate("Group"), value: "Group"},

                  {text: Scratch.translate("Ambient Light"), value: "AmbientLight"},
                  {text: Scratch.translate("Point Light"), value: "PointLight"},
                  {text: Scratch.translate("Directional Light"), value: "DirectionalLight"},
                  {text: Scratch.translate("Hemisphere Light"), value: "HemisphereLight"},
                  {text: Scratch.translate("Spot Light"), value: "SpotLight"},

                  {text: Scratch.translate("Perspective Camera"), value: "PerspectiveCamera"},
                  {text: Scratch.translate("Orthographic Camera"), value: "OrthographicCamera"},
                  {text: Scratch.translate("Cube Camera"), value: "CubeCamera"},
                ]
              },
              meshProperties: { items: [
                { text: Scratch.translate("Geometry"), value: "geometry" },
                { text: Scratch.translate("Material"), value: "material" }
              ]},
              cameraProperties: { items: [
                { text: Scratch.translate("Fov"), value: "fov" },
                { text: Scratch.translate("Near"), value: "near" },
                { text: Scratch.translate("Far"), value: "far" },
                { text: Scratch.translate("Zoom"), value: "zoom" }
              ]},
              geometryType: { items: [
                { text: Scratch.translate("Empty"), value: "BufferGeometry" },
                { text: Scratch.translate("Cube"), value: "BoxGeometry" },
                { text: Scratch.translate("Capsule"), value: "CapsuleGeometry" },
                { text: Scratch.translate("Circle"), value: "CircleGeometry" },
                { text: Scratch.translate("Cone"), value: "ConeGeometry" },
                { text: Scratch.translate("Dodecahedron"), value: "DodecahedronGeometry" },
                { text: Scratch.translate("Icosahedron"), value: "IcosahedronGeometry" },
                { text: Scratch.translate("Octahedron"), value: "OctahedronGeometry" },
                { text: Scratch.translate("Plane"), value: "PlaneGeometry" },
                { text: Scratch.translate("Sphere"), value: "SphereGeometry" },
                { text: Scratch.translate("Tetrahedron"), value: "TetrahedronGeometry" },
                { text: Scratch.translate("Torus"), value: "TorusGeometry" },
                { text: Scratch.translate("Torus Knot"), value: "TorusKnotGeometry" }
              ]},
              geometryProperties: { items: [
                { text: Scratch.translate("Vertex Points [XYZ]"), value: "position" },
                { text: Scratch.translate("Texture Points [UV]"), value: "uv" },
                { text: Scratch.translate("Face Points (Normals) [XYZ]"), value: "normal" }
              ]},
              materialType: { items: [
                {text: Scratch.translate("Mesh Basic"), value: "MeshBasicMaterial"},
                {text: Scratch.translate("Mesh Standard"), value: "MeshStandardMaterial"},
                {text: Scratch.translate("Mesh Normal"), value: "MeshNormalMaterial"},
                {text: Scratch.translate("Mesh Toon"), value: "MeshToonMaterial"},
                {text: Scratch.translate("Mesh Depth"), value: "MeshDepthMaterial"},
                {text: Scratch.translate("Mesh Physical"), value: "MeshPhysicalMaterial"},
                {text: Scratch.translate("Mesh Phong"), value: "MeshPhongMaterial"},
                {text: Scratch.translate("Mesh Lambert"), value: "MeshLambertMaterial"},
                {text: Scratch.translate("Mesh Matcap"), value: "MeshMatcapMaterial"},

                {text: Scratch.translate("Line Basic"), value: "LineBasicMaterial"},
                {text: Scratch.translate("Line Dashed"), value: "LineDashedMaterial"},

                {text: Scratch.translate("Points"), value: "PointsMaterial"},

                {text: Scratch.translate("Sprite"), value: "SpriteMaterial"},

                {text: Scratch.translate("Shadow"), value: "ShadowMaterial"},
              ]},
              materialNumeralProperties: { items: [
                { text: Scratch.translate("Opacity"), value: "opacity" },
                { text: Scratch.translate("Roughness"), value: "roughness" },
                { text: Scratch.translate("Metalness"), value: "metalness" },
                { text: Scratch.translate("Emissive Intensity"), value: "emissiveIntensity" },
                { text: Scratch.translate("Reflectivity"), value: "reflectivity" },
                { text: Scratch.translate("Alpha Test"), value: "alphaTest" },
                { text: Scratch.translate("Shininess"), value: "shininess" },
                { text: Scratch.translate("Refraction Ratio"), value: "refractionRatio" },
                { text: Scratch.translate("Polygon Offset Factor"), value: "polygonOffsetFactor" },
                { text: Scratch.translate("Polygon Offset Units"), value: "polygonOffsetUnits" }
              ]},
              materialBooleanProperties: { items: [
                { text: Scratch.translate("Visible"), value: "visible" },
                { text: Scratch.translate("Transparent"), value: "transparent" },
                { text: Scratch.translate("Wireframe"), value: "wireframe" },
                { text: Scratch.translate("Fog"), value: "fog" },
                { text: Scratch.translate("Depth Test"), value: "depthTest" },
                { text: Scratch.translate("Depth Write"), value: "depthWrite" },
                { text: Scratch.translate("Color Write"), value: "colorWrite" },
                { text: Scratch.translate("Flat Shading"), value: "flatShading" },
                { text: Scratch.translate("Vertex Colors"), value: "vertexColors" },
                { text: Scratch.translate("Tone Mapped"), value: "toneMapped" },
                { text: Scratch.translate("Alpha Hash"), value: "alphaHash" },
                { text: Scratch.translate("Dithering"), value: "dithering" },
                { text: Scratch.translate("Polygon Offset"), value: "polygonOffset" }
              ]},
              materialColorProperties: { items: [
                { text: Scratch.translate("Color"), value: "color" },
                { text: Scratch.translate("Emissive"), value: "emissive" },
                { text: Scratch.translate("Specular"), value: "specular" },
                { text: Scratch.translate("Sheen"), value: "sheen" }
              ]},
              materialMapProperties: { items: [
                { text: Scratch.translate("Texture"), value: "map" },
                { text: Scratch.translate("Alpha Texture"), value: "alphaMap" },
                { text: Scratch.translate("Normal Texture"), value: "normalMap" },
                { text: Scratch.translate("Roughness Texture"), value: "roughnessMap" },
                { text: Scratch.translate("Metalness Texture"), value: "metalnessMap" },
                { text: Scratch.translate("Emissive Texture"), value: "emissiveMap" },
                { text: Scratch.translate("Environment Texture"), value: "envMap" },
                { text: Scratch.translate("Ambient Occlusion Texture"), value: "aoMap" },
                { text: Scratch.translate("Bump Texture"), value: "bumpMap" },
                { text: Scratch.translate("Displacement Texture"), value: "displacementMap" }
              ]},
              textureProperties: { items: [
                { text: Scratch.translate("Repeat (V2)"), value: "repeat" },
                { text: Scratch.translate("Center (V2)"), value: "center" },
                { text: Scratch.translate("Offset (V2)"), value: "offset" },
                { text: Scratch.translate("Anisotropy (Number)"), value: "anisotropy" },
                { text: Scratch.translate("Rotation (Number)"), value: "rotation" },
                { text: Scratch.translate("Premultiply Alpha (Boolean)"), value: "premultiplyAlpha" },
              ]},
              textureWarp: { items: [
                { text: Scratch.translate("Repeat Wrapping"), value: "1000" },
                { text: Scratch.translate("Clamp To Edge Wrapping"), value: "1001" },
                { text: Scratch.translate("Mirrored Repeat Wrapping"), value: "1002" },
              ]},
              magFilter: { items: [
                { text: Scratch.translate("Linear Filter (Blurred)"), value: "LinearFilter" },
                { text: Scratch.translate("Nearest Filter (Pixelated)"), value: "NearestFilter" }
              ]},
              minFilter: { items: [
                { text: Scratch.translate("Linear Filter"), value: "LinearFilter" },
                { text: Scratch.translate("Linear Mipmap Linear Filter"), value: "LinearMipmapLinearFilter" },
                { text: Scratch.translate("Linear Mipmap Nearest Filter"), value: "LinearMipmapNearestFilter" },
                { text: Scratch.translate("Nearest Filter"), value: "NearestFilter" },
                { text: Scratch.translate("Nearest Mipmap Linear Filter"), value: "NearestMipmapLinearFilter" },
                { text: Scratch.translate("Nearest Mipmap Nearest Filter"), value: "NearestMipmapNearestFilter" }
              ]},
              rendererProperties: { items: ["autoClear", "autoClearColor", "autoClearDepth", "sortObjects", "toneMappingExposure", "transmissionResolutionScale"] },
              clearBuffers: { items: [
                { text: Scratch.translate("All"), value: "clear" },
                { text: Scratch.translate("Color"), value: "clearColor" },
                { text: Scratch.translate("Depth"), value: "clearDepth" }
              ]},
              sceneProperties: {items: [
                { text: Scratch.translate("Background"), value: "background" },
                { text: Scratch.translate("Background Blurriness"), value: "backgroundBlurriness" },
                { text: Scratch.translate("Background Intensity"), value: "backgroundIntensity" },
                { text: Scratch.translate("Background Rotation"), value: "backgroundRotation" },

                { text: Scratch.translate("Environment"), value: "environment" },
                { text: Scratch.translate("Environment Intensity"), value: "environmentIntensity" },
                { text: Scratch.translate("Environment Rotation"), value: "environmentRotation" },

                { text: Scratch.translate("Fog"), value: "fog" },

                { text: Scratch.translate("Override Material"), value: "overrideMaterial" }
              ]},
              light: { items: [
                { text: Scratch.translate("Color"), value: "color" },
                { text: Scratch.translate("Intensity"), value: "intensity" }
              ]},
              hemisphereLight: { items: [
                { text: Scratch.translate("Sky Color"), value: "skyColor" },
                { text: Scratch.translate("Ground Color"), value: "groundColor" },
              ]},
              pointLight: { items: [
                { text: Scratch.translate("Distance"), value: "distance" },
                { text: Scratch.translate("Decay"), value: "decay" },
                { text: Scratch.translate("Power"), value: "power" },
              ]},
              spotLight: { items: [
                { text: Scratch.translate("Angle"), value: "angle" },
                { text: Scratch.translate("Penumbra"), value: "penumbra" },
                { text: Scratch.translate("Texture"), value: "map" },
              ]},
              reset: {items: [
                {text: Scratch.translate("everything"), value: "everything"}
              ]},
              stats: {items: [
                {text: Scratch.translate("memory"), value: "memory"},
                {text: Scratch.translate("render"), value: "render"},
              ]}
            },

          };
        }

        openExtra() {open("https://threejs.org/docs")}

        reset(args) {
          switch (args.VALUE) {
            case "everything":
              scene.children.forEach(
                o => {
                  o.geometry ? o.geometry.dispose() : null;
                  o.material ? o.material.dispose() : null;
                  o.removeFromParent();
                }
              );
              assets.geometries.forEach(
                o => o.dispose()
              );
              assets.materials.forEach(
                o => o.dispose()
              );
              assets.textures.forEach(
                o => o.dispose()
              );

              assets.objects.clear();
              assets.geometries.clear();
              assets.materials.clear();
              assets.textures.clear();
              scene = new THREE.Scene();
              camera = new THREE.PerspectiveCamera(90, width/height);
              camera.position.z = 2;
              assets.objects.set("camera", camera);
          }

          three.renderer.clear();
        }

        stats(args) {
          return three.renderer.info[args.VALUE];
        }

        vector2(args) {return `[${args.X}, ${args.Y}]`;}
        vector3(args) {return `[${args.X}, ${args.Y}, ${args.Z}]`;}

        renderer(args) {
          three.renderer[args.PROPERTY] = JSON.parse(args.VALUE); // is there a better way than .parse? - Civ
        }
        rendererClear(args) {
          three.renderer[args.B]();
          render();
        }

        scene(args) {
          let value;
          try { value = JSON.parse(args.VALUE); }
          catch {
            if (args.VALUE.at(0) == "#") value = new THREE.Color(args.VALUE);
            else value = assets.textures.get(args.VALUE); 
          }
          scene[args.PROPERTY] = value;
        }

        deleteAsset(args) {
          const asset = assets[args.TYPE].get(args.NAME);
          console.error("not found");
          switch (args.TYPE) {
            case "objects":
              asset.removeFromParent();
              break;
            default:  asset.dispose();
          }
           assets[args.TYPE].delete(args.NAME);
        }

        setTransform(args) {
          const obj = assets.objects.get(args.OBJECT);
          let v3 = new THREE.Vector3().fromArray(JSON.parse(args.VALUE));
          if (args.TRANSFORM == "rotation") { 
            v3 = v3.multiplyScalar(RadiansMultiplier);
            obj.rotation.setFromVector3(v3);
          } else obj[args.TRANSFORM].copy(v3);
        }

        getTransform(args) {
          let v3 = assets.objects.get(args.OBJECT)[args.TRANSFORM].toArray();
          args.TRANSFORM == "rotation" ? v3 = v3.slice(0,3).map(r=>r*180/Math.PI) : null;
          return JSON.stringify(v3);
        }

        transformTransform(args) {
          const obj = assets.objects.get(args.OBJECT);
          let v = args.VALUE;
          args.TRANSFORM == "rotation" ? v = v*RadiansMultiplier : null;
          args.ACTION == "set" ? obj[args.TRANSFORM][args.XYZ] = v : obj[args.TRANSFORM][args.XYZ] += v;
        }

        setRotation(args) {
          const obj = assets.objects.get(args.OBJECT);
          obj.rotation.order = args.ORDER;
        }

        getAxis(args) {
          return JSON.parse(args.V3)[{"x":0, "y":1, "z": 2}[args.XYZ]];
        }

        operateVector(args) {
          const v = new THREE.Vector3().fromArray(JSON.parse(args.V));
          let r = v[args.OPERATION]();
          typeof(r) == "object" ? r = r.toArray() : null;
          return JSON.stringify(r);
        }

        operate2Vector(args) {
          const v1 = new THREE.Vector3().fromArray(JSON.parse(args.V1));
          let v2 = JSON.parse(args.V2);
          typeof(v2) == "number" ? null : v2 = new THREE.Vector3().fromArray(v2);
          let r = v1[args.OPERATION](v2);
          typeof(r) == "object" ? r = r.toArray() : null;
          return JSON.stringify(r);
        }

        directionToVector(args) {
          const v1 = new THREE.Vector3().fromArray(JSON.parse(args.V1));
          const v2 = new THREE.Vector3().fromArray(JSON.parse(args.V2));

          const direction = v1.sub(v2).normalize();
          const pitch = Math.atan2(-direction.y, Math.sqrt(direction.x*direction.x + direction.z*direction.z)) * 180/Math.PI;
          const yaw = Math.atan2(direction.x, direction.z) * 180/Math.PI;

          return JSON.stringify([pitch,yaw,0]);
        }

        interpolateVectors(args) {
          const v1 = new THREE.Vector3().fromArray(JSON.parse(args.V1));
          const v2 = new THREE.Vector3().fromArray(JSON.parse(args.V2));
          const r = v1.lerp(v2, args.A/100);
          return JSON.stringify(r.toArray());
        }

        createMesh(args){
          //* is this supposed to be assets.objects.get(args.GEOMETRY) instead of get(GEOMETRY)? I updated it for you. - Brackets
          //im unsure about this block. we can create an empty mesh with addObject(). Then assign a material and a geometry to it. - Civero
          assets.objects.set(args.NAME, new THREE.Mesh(assets.objects.get(args.GEOMETRY), assets.objects.get(args.MATERIAL)));
        }

        addObject(args) {
          if (this.objectExists({NAME: args.NAME})) {
            console.warn(`Already existing object named "${args.NAME}". Will replace!`);
            const obj = assets.objects.get(args.NAME);
            scene.remove(obj);
          }
          const obj = new THREE[args.TYPE]();

          assets.objects.set(args.NAME, obj);
          const parent = assets.objects.get(args.PARENT);

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
              obj.material = defaultMat;
              obj.geometry = defaultGeo;
              break;
            case "SpotLight" || "DirectionalLight":
              parent.add(obj.target);
              break;
          }

          if (args.PARENT == "scene") {
            scene.add(obj);
          } else if (!parent) { //should search in another map for scenes with that name (future) - Civ
            console.error(`No object named "${args.PARENT}". Adding to scene.`);
            scene.add(obj);
          } else parent.add(obj);
        }

        objectExists(args){
          if(assets.objects.get(args.NAME)) return true; 
          else return false;
        }

        setRenderingCamera(args){
          const selected = assets.objects.get(args.NAME);
          if (!selected) {
            console.error(`No object named "${args.NAME}"`);
            return;
          }
          camera = selected;
        }

        camera() {return [...assets.objects.entries()].find(([k, v]) => v === camera)?.[0];}

        setObject(args) {
          let data;
          const obj = assets.objects.get(args.NAME);

          switch (args.PROPERTY) {
            case "geometry":
              data = assets.geometries.get(args.DATA);
              obj.geometry = data;
              break;
            case "material":
              data = assets.materials.get(args.DATA);
              obj.material = data;
          }
        }

        createGeometry(args) {
          let geometry = assets.geometries.get(args.NAME);
          if (geometry) {
            console.warn(`Already existing geometry named "${args.NAME}". Will replace!`);
            geometry.dispose();
          }
          geometry = new THREE[args.TYPE]();
          assets.geometries.set(args.NAME, geometry);
        }

        setGeometry(args) {
          const geometry = assets.geometries.get(args.NAME);

          let data, dataLength;
          data = args.DATA.split(" ").map(p=>JSON.parse(p)).flat(); //from [0,0,0] [0,0,1] to 0,0,0,0,0,1

          switch (args.PROPERTY) {
            case "position" || "normal":
              dataLength = 3; //v3
              break;
            case "uv":
              dataLength = 2;
              break;
          }

          geometry.setAttribute(args.PROPERTY, new THREE.BufferAttribute(new Float32Array(data), dataLength));
        }

        createMaterial(args) {
          let material = assets.materials.get(args.NAME);
          if (material) {
            console.warn(`Already existing material named "${args.NAME}". Will replace!`);
            material.dispose();
          }
          material = new THREE[args.TYPE]();
          assets.materials.set(args.NAME, material);
        }

        setMaterial(args) {
          const material = assets.materials.get(args.NAME);
          material[args.PROPERTY] = args.DATA;
          material.needsUpdate = true;
        }
        setColorMaterial(args) {
          args.DATA = new THREE.Color(args.DATA);
          this.setMaterial(args);
        }
        setBoolMaterial(args) {
          args.DATA = JSON.parse(args.DATA);
          this.setMaterial(args);
        }
        setMapMaterial(args) {
          args.DATA = assets.textures.get(args.DATA);
          this.setMaterial(args);
        }

        async loadTexture(args) {
          const img = Scratch.vm.editingTarget.getCostumes()[(Scratch.vm.editingTarget.getCostumeIndexByName(args.COSTUME))].asset.encodeDataURI();
          const texture = await three.textureLoader.loadAsync(img);
          texture.colorSpace = "srgb";
          assets.textures.set(args.NAME, texture);
        }

        setTextureWrap(args) {
          const texture = assets.textures.get(args.NAME);
          texture.wrapS = args.U;
          texture.wrapT = args.V;
          texture.needsUpdate = true;
        }

        setTextureFilter(args) {
          const texture = assets.textures.get(args.NAME);
          texture.magFilter = THREE[args.MAG];
          texture.minFilter = THREE[args.MIN];
          texture.needsUpdate = true;
        }

        setTexture(args) {
          const texture = assets.textures.get(args.NAME);
          let r = JSON.parse(args.VALUE);
          typeof(r) == "object" ? r = new THREE.Vector2().fromArray(r) : null;
          texture[args.PROPERTY] = r;
          texture.needsUpdate = true;
        }

        setCamera(args) {
          const cam = assets.objects.get(args.NAME);
          if (cam.isCamera) {
            cam[args.PROPERTY] = JSON.parse(args.VALUE);
            cam.updateProjectionMatrix();
          } else console.error(`${args.NAME} is not a camera!`);
        }

        setLight(args) {
          const light = assets.objects.get(args.NAME);
          let r = args.VALUE;
          if (light.isLight) {
            //texture? color?
            args.PROPERTY == "map" ? r = assets.textures.get(args.VALUE) : typeof(r) == "string" && r.at(0) == "#" ? r = new THREE.Color(r) : r = JSON.parse(r);
            light[args.PROPERTY] = r;
          } else console.error(`${args.NAME} is not a light!`);
        }
        setPointLight(args) {this.setLight(args);}
        setSpotLight(args) {this.setLight(args);}
        setHemisphereLight(args) {
          if (args.PROPERTY == "skyColor") {
            const light = assets.objects.get(args.NAME);
            assets.objects.delete(args.NAME);
            light.removeFromParent();

            const r = new THREE.HemisphereLight(args.VALUE, "#"+light.groundColor.getHexString(), light.intensity);
            light.dispose();

            assets.objects.set(args.NAME, r);
            scene.add(r);
          } else this.setLight(args);
        }
        setTargetLight(args) {
          const light = assets.objects.get(args.NAME);
          if (light.isSpotLight || light.isDirectionalLight ) {
            light.target.position.set(...JSON.parse(args.VALUE));
            light.target.updateMatrixWorld();
          } else console.error(`${args.NAME} is not a light or it's an invalid type!`);
        }

        touching(args) {
          let a = new THREE.Box3().setFromObject( assets.objects.get(args.A) );
          let b = new THREE.Box3().setFromObject( assets.objects.get(args.B) );

          return a.intersectsBox(b);
        }
        

      }

      Scratch.extensions.register(new ThreeJS());
      loopId = requestAnimationFrame(loop);
      loop();

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
