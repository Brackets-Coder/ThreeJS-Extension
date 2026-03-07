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

  const extensionID = "threejsextensionciveroversion";

  let width, height;
  let lastCanvas;

  const THREE = await import("https://esm.sh/three@0.182.0");
  const {TextGeometry} = await import ("https://esm.sh/three@0.182.0/addons/geometries/TextGeometry.js");
  const {OrbitControls} = await import("https://esm.sh/three@0.182.0/examples/jsm/controls/OrbitControls.js");
  const {GLTFLoader} = await import("https://esm.sh/three@0.182.0/addons/loaders/GLTFLoader.js");
  const {OBJLoader} = await import("https://esm.sh/three@0.182.0/addons/loaders/OBJLoader.js");
  const {FBXLoader} = await import("https://esm.sh/three@0.182.0/addons/loaders/FBXLoader.js");
  const {FontLoader} = await import ("https://esm.sh/three@0.182.0/addons/loaders/FontLoader.js");
  let opentype;

  let three, loopId, clock, defaultGeo, defaultMat, storedFog, storedRaycast;
  let rawBuffer, gpuView, renderData;
  let scene, camera;

  let assets = {
    objects: new Map(),
    geometries: new Map(),
    materials: new Map(),
    textures: new Map(),
    addons: new Map(),
    audios: new Map(),
  };

  const setupThree = async () => {
    const renderer = new THREE.WebGLRenderer({
      preserveDrawingBuffer: true,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = 1;

    const context = renderer.getContext();
    const TextureLoader = new THREE.TextureLoader();
    const GLTFLoad = new GLTFLoader();
    const OBJLoad = new OBJLoader();
    const FBXLoad = new FBXLoader();
    const TextLoader = new FontLoader();
    const MathUtils = THREE.MathUtils;
    const AudioListener = new THREE.AudioListener();
    const AudioLoader = new THREE.AudioLoader();
    
    const {RectAreaLightUniformsLib} = await import("https://esm.sh/three@0.182.0/addons/lights/RectAreaLightUniformsLib.js");
    RectAreaLightUniformsLib.init();

    return { renderer, context, TextureLoader, GLTFLoad, OBJLoad, FBXLoad, MathUtils, TextLoader, AudioListener, AudioLoader };
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        this.onNativeSizeChanged();
      }

      getTexture() {
        return this._texture;
      }

      updateTexture(data) {
        const gl = this._renderer.gl;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          three.renderer.domElement
        );
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        this._silhouette.update(three.renderer.domElement);
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

        this.updateTexture();
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
    if (renderer.markDrawableAsNoninteractive) {
      renderer.markDrawableAsNoninteractive(threeDrawableId);
    }
  };

  async function init() {
    three = await setupThree();
    setupSkin();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(90, width/height);
    camera.name = "camera";
    camera.add(three.AudioListener);
    camera.position.z = 2;
    assets.objects.set("camera", camera);
    clock = new THREE.Clock();

    defaultGeo = new THREE.BoxGeometry();
    defaultMat = new THREE.MeshMatcapMaterial();
    defaultMat.map = await three.TextureLoader.loadAsync(`data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIyODMiIGhlaWdodD0iMjgzIiB2aWV3Qm94PSIwLDAsMjgzLDI4MyI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTk5LjQ0ODk1LC0zOS4xMTMzNSkiPjxnIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIj48cGF0aCBkPSJNMzgyLjQ0ODk1LDM5LjExMzM1djI4M2gtMjgzdi0yODN6IiBmaWxsPSIjNjY2NjY2IiBzdHJva2Utd2lkdGg9IjAiLz48cGF0aCBkPSJNMTkzLjc4MjI4LDM5LjExMzM1djk0LjMzMzMzaC05NC4zMzMzM3YtOTQuMzMzMzN6IiBmaWxsPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjAiLz48cGF0aCBkPSJNMzgyLjQ0ODk1LDM5LjExMzM1djk0LjMzMzMzaC05NC4zMzMzM3YtOTQuMzMzMzN6IiBmaWxsPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjAiLz48cGF0aCBkPSJNMTkzLjc4MjI5LDIyNy43ODAwMnY5NC4zMzMzM2gtOTQuMzMzMzN2LTk0LjMzMzMzeiIgZmlsbD0iIzk5OTk5OSIgc3Ryb2tlLXdpZHRoPSIwIi8+PHBhdGggZD0iTTI4Ny4xNjY2NiwxMzIuODMzMzR2OTQuMzMzMzNoLTk0LjMzMzMzdi05NC4zMzMzM3oiIGZpbGw9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMCIvPjxwYXRoIGQ9Ik0zODIuNDQ4OTUsMjI3Ljc4MDAydjk0LjMzMzMzaC05NC4zMzMzNHYtOTQuMzMzMzN6IiBmaWxsPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjAiLz48dGV4dCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMDUuNSwzMDIuMjg2OTMpIHNjYWxlKDAuNzc2NDgsMC43NzY0OCkiIGZvbnQtc2l6ZT0iNDAiIHhtbDpzcGFjZT0icHJlc2VydmUiIGZpbGw9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMSIgZm9udC1mYW1pbHk9IlNlcmlmIiBmb250LXdlaWdodD0ibm9ybWFsIiB0ZXh0LWFuY2hvcj0ic3RhcnQiPjx0c3BhbiB4PSIwIiBkeT0iMCI+bm8gbWF0ZXJpYWw8L3RzcGFuPjwvdGV4dD48dGV4dCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzNzQuNSw1Ny43MTMxNSkgcm90YXRlKC0xODApIHNjYWxlKDAuNzc2NDksMC43NzY0OSkiIGZvbnQtc2l6ZT0iNDAiIHhtbDpzcGFjZT0icHJlc2VydmUiIGZpbGw9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMSIgZm9udC1mYW1pbHk9IlNlcmlmIiBmb250LXdlaWdodD0ibm9ybWFsIiB0ZXh0LWFuY2hvcj0ic3RhcnQiPjx0c3BhbiB4PSIwIiBkeT0iMCI+bm8gbWF0ZXJpYWw8L3RzcGFuPjwvdGV4dD48L2c+PC9nPjwvc3ZnPg==`);
    defaultMat.map.wrapS = 1000;
    defaultMat.map.wrapT = 1000;
    defaultMat.map.colorSpace = "srgb";
    defaultMat.map.needsUpdate = true;

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
      three.renderer.clear();
    });

    const originalHQP = Scratch.vm.renderer.setUseHighQualityRender;
    Scratch.vm.renderer.setUseHighQualityRender = function(state) {
      originalHQP.call(Scratch.vm.renderer, state);
    };
  }

  const render = () => {
    if (camera && scene) {
      three.renderer.render(scene, camera);

      three.skin.updateTexture();
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

  async function requestFile(format) {
    const file = await new Promise((resolve) => {
      const input = document.createElement("input");
        input.type = "file";
        input.accept = format;
        input.multiple = false;
        input.onchange = () => {
          resolve(input.files);
          input.remove();
        };
        input.click();
    });

    const url = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(file[0]);
    });

    return {name: file[0].name, url: url};
  }

  Promise.resolve(init())
    .then(() => {

      class ThreeJS {
        getInfo() {
          return {
            id: extensionID,
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
                color1: "#C84630",
                arguments: {
                  VALUE: { type: Scratch.ArgumentType.STRING, menu: "reset" },
                },
              },
              {
                opcode: "stats",
                color1: "#C84630",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [VALUE]",
                disableMonitor: true,
                arguments: {
                  VALUE: { type: Scratch.ArgumentType.STRING, menu: "stats" },
                },
              },

              "---",
              {
                opcode: "deleteAsset",
                blockType: Scratch.BlockType.COMMAND,
                text: "delete [TYPE] named [NAME]",
                color1: "#C84630",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "assetType" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                },
              },

              "---",

              {
                opcode: "renderer",
                blockType: Scratch.BlockType.COMMAND,
                text: "set renderer [PROPERTY] to [VALUE]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "rendererProperties" },
                  VALUE: { type: Scratch.ArgumentType.STRING, menu: "boolean" },
                },
              },
              {
                opcode: "getRenderer",
                blockType: Scratch.BlockType.REPORTER,
                text: "get renderer [PROPERTY]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "rendererGetProperties" },
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
              {
                opcode: "rendererRender",
                blockType: "command",
                text: "render",
              },
              
              {
                opcode: "rendererShadow",
                blockType: Scratch.BlockType.COMMAND,
                text: "set renderer shadows to [PROPERTY]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "shadowMapTypes" },
                },
              },

              "---",

              {
                opcode: "scene",
                blockType: Scratch.BlockType.COMMAND,
                text: "set scene [PROPERTY] to [VALUE]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "sceneProperties" },
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "#222222" },
                },
              },
              {
                opcode: "getScene",
                blockType: Scratch.BlockType.REPORTER,
                text: "get scene [PROPERTY]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "sceneProperties" },
                },
              },
              "---",
              {
                opcode: "color",
                blockType: Scratch.BlockType.REPORTER,
                text: "get color [COLOR]",
                arguments: {
                  COLOR: { type: Scratch.ArgumentType.COLOR },
                },
              },
              {
                opcode: "createFog",
                blockType: Scratch.BlockType.REPORTER,
                text: "new fog [COLOR] start [NEAR] end [FAR]",
                arguments: {
                  COLOR: { type: Scratch.ArgumentType.COLOR },
                  NEAR: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1" },
                  FAR: { type: Scratch.ArgumentType.NUMBER, defaultValue: "10" },
                },
              },
              {
                opcode: "createFog2",
                blockType: Scratch.BlockType.REPORTER,
                text: "new exponential fog [COLOR] density [DENSITY]",
                arguments: {
                  COLOR: { type: Scratch.ArgumentType.COLOR },
                  DENSITY: { type: Scratch.ArgumentType.NUMBER, defaultValue: "0.05" },
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
                text: "object [NAME] exists?",
                color1: "#5FAD56",
                arguments: {
                    NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object"},
                }
              },
              {
                opcode: "setObject",
                blockType: Scratch.BlockType.COMMAND,
                text: "set object [NAME] [PROPERTY] to [DATA]",
                color1: "#5FAD56",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "meshProperties", defaultValue: "material" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              {
                opcode: "setObjectBool",
                blockType: Scratch.BlockType.COMMAND,
                text: "set object [NAME] [PROPERTY] [DATA]",
                color1: "#5FAD56",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "meshBoolProperties" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  DATA: { type: Scratch.ArgumentType.STRING, menu: "boolean" },
                },
              },
              {
                opcode: "getObjectBool",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "get object [NAME] [PROPERTY]",
                color1: "#5FAD56",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "meshBoolProperties" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                },
              },

              "---",

              {
                opcode: "createInstance",
                blockType: Scratch.BlockType.COMMAND,
                text: "add instanced mesh [NAME] with geometry [GEOMETRY] material [MATERIAL] count [COUNT]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: "string", defaultValue: "forest" },
                  GEOMETRY: { type: "string", defaultValue: "cube" },
                  MATERIAL: { type: "string", defaultValue: "red" },
                  COUNT: { type: "number", defaultValue: 7 },
                },
              },
              {
                opcode: "setInstance",
                blockType: Scratch.BlockType.COMMAND,
                text: "set instanced mesh [NAME] item [INDEX] [PROPERTY] to [MATRIX]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: "string", defaultValue: "forest" },
                  INDEX: { type: "number", defaultValue: 1 },
                  PROPERTY: { type: "string", menu: "instanceItems"},
                  MATRIX: { type: "string", defaultValue: "[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]" },
                },
              },

              //BatchedMesh maybe? Reporters for all values!

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
                  TRANSFORM: { type: Scratch.ArgumentType.STRING, menu: "gettransformType" },
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
                opcode: "getVectorProjected",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [V] projected to stage",
                color1: "#5C80BC",
                arguments: {
                  V: { type: Scratch.ArgumentType.STRING, defaultValue: "[-1,2,-4]" },
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
                opcode: "moveVector",
                blockType: Scratch.BlockType.REPORTER,
                text: "move [V] [STEPS] steps in direction [D] order [ORDER]",
                color1: "#5C80BC",
                arguments: {
                  V: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]" },
                  D: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]" },
                  STEPS: { type: Scratch.ArgumentType.NUMBER, defaultValue: "5" },
                  ORDER: { type: Scratch.ArgumentType.STRING, menu: "XYZorder" },
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

              {blockType: "label",
              text: Scratch.translate("Matrix")},

              {
                opcode: "doMatrix",
                blockType: Scratch.BlockType.REPORTER,
                text: "create matrix from position [POSITION] rotation [ROTATION] scale [SCALE]",
                color1: "#5C80BC",
                arguments: {
                  POSITION: { type: Scratch.ArgumentType.STRING, defaultValue: "[1,0,0]" },
                  ROTATION: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,90,0]" },
                  SCALE: { type: Scratch.ArgumentType.STRING, defaultValue: "[1,1,1]" },
                },
              },
              {
                opcode: "getMatrixTransform",
                blockType: Scratch.BlockType.REPORTER,
                text: "get [TRANSFORM] of matrix [M]",
                color1: "#5C80BC",
                arguments: {
                  TRANSFORM: { type: Scratch.ArgumentType.STRING, menu: "transformType" },
                  M: { type: Scratch.ArgumentType.STRING, defaultValue: "[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]" },
                },
              },

              "---",
                           
              {blockType: "label",
              text: Scratch.translate("Models")},

              {
                blockType: "button",
                text: Scratch.translate("Import model"),
                func: "loadModel" 
              },
              {
                opcode: "addModel",
                blockType: Scratch.BlockType.COMMAND,
                text: "add model [FILE] named [NAME] to [PARENT]",
                color1: "#5FAD56",
                arguments: {
                  FILE: { type: "string", menu: "loadedModels" },
                  NAME: { type: "string", defaultValue: "star destroyer" },
                  PARENT: { type: "string", defaultValue: "scene" },
                },
              },
              {
                opcode: "removeModel",
                blockType: Scratch.BlockType.COMMAND,
                text: "remove model file [FILE]",
                color1: "#C84630",
                arguments: {
                  FILE: { type: "string", menu: "loadedModels" },
                },
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Geometries")},

              {
                opcode: "createGeometry",
                blockType: Scratch.BlockType.COMMAND,
                text: "create [TYPE] geometry named [NAME]",
                color1: "#7c4d5e",
                arguments: {
                  TYPE: { type: Scratch.ArgumentType.STRING, menu: "geometryType", defaultValue: "BoxGeometry" },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "cube" },
                },
              },
              {
                opcode: "setGeometry",
                blockType: Scratch.BlockType.COMMAND,
                text: "set geometry [NAME] [PROPERTY] to [DATA]",
                color1: "#7c4d5e",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "geometryProperties"},
                  DATA: { type: Scratch.ArgumentType.STRING, defaultValue: "[-0.5,0.5,0,0.5,0.5,0,-0.5,-0.5,0,0.5,-0.5,0]"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "cube" },
                },
              },
              {
                opcode: "getGeometry",
                blockType: Scratch.BlockType.REPORTER,
                text: "get geometry [NAME] [PROPERTY]",
                color1: "#7c4d5e",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "geometryProperties"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "cube"},
                },
              },
              "---",
              {
                blockType: "button",
                text: Scratch.translate("Import font"),
                func: "loadFont" 
              },
              {
                opcode: "createTextGeometry",
                blockType: Scratch.BlockType.COMMAND,
                text: "create geometry with font [FILE] named [NAME] displaying text [TEXT] with depth [DEPTH]",
                color1: "#7c4d5e",
                arguments: {
                  FILE: { type: "string", menu: "loadedFonts" },
                  NAME: { type: "string", defaultValue: "text" },
                  TEXT: { type: "string", defaultValue: "Cool 3D text!" },
                  DEPTH: {type: "number", defaultValue: "1"}
                },
              },
              {
                opcode: "removeFont",
                blockType: Scratch.BlockType.COMMAND,
                text: "remove font file [FILE]",
                color1: "#C84630",
                arguments: {
                  FILE: { type: "string", menu: "loadedFonts" },
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
              {
                opcode: "setMaterialSide",
                blockType: Scratch.BlockType.COMMAND,
                text: "set material [NAME] to [DATA] side rendering",
                color1: "#694D7C",
                arguments: {
                  DATA: { type: Scratch.ArgumentType.STRING, menu: "materialSides"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              //Blending modes!
              {
                opcode: "setMaterialBlending",
                blockType: Scratch.BlockType.COMMAND,
                text: "set material [NAME] to [DATA] blending",
                color1: "#694D7C",
                arguments: {
                  DATA: { type: Scratch.ArgumentType.STRING, menu: "materialBlending"},
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "red" },
                },
              },
              {
                opcode: "joinMaterial",
                blockType: Scratch.BlockType.REPORTER,
                text: "join [MATERIAL] with [MATERIAL2]",
                arguments: {
                  MATERIAL: { type: Scratch.ArgumentType.STRING, defaultValue: "red"},
                  MATERIAL2: { type: Scratch.ArgumentType.STRING, defaultValue: "blue" },
                },
              },
              


              "---",

              {
                opcode: "loadTexture",
                blockType: Scratch.BlockType.COMMAND,
                text: "load Texture from [COSTUME] as [NAME]",
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
              {
                opcode: "setTextureMapping",
                blockType: "command",
                text: "set texture [NAME] mapping to [VALUE]",
                color1: "#694D7C",
                arguments: {
                  NAME: { type: "string", defaultValue: "sky"},
                  VALUE: { type: "string", menu: "textureMapping"},
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
                opcode: "getCamera",
                blockType: Scratch.BlockType.REPORTER,
                text: "get camera [NAME] [PROPERTY]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "camera" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "cameraProperties"},
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
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "1"},
                }
              },
              {
                opcode: "setLightColor",
                blockType: Scratch.BlockType.COMMAND,
                text: "for light [NAME] set [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "lightColors"},
                  VALUE: { type: Scratch.ArgumentType.COLOR},
                }
              },
              {
                opcode: "setLightMap",
                blockType: "command",
                text: "for Spot light [NAME] set [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "lightStrings"},
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "batsignal"},
                }
              },
              {
                opcode: "setTargetLight",
                blockType: Scratch.BlockType.COMMAND,
                text: "for Spot, Directional light [NAME] target to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},
                }
              },
              {
                opcode: "getLight",
                blockType: Scratch.BlockType.REPORTER,
                text: "get light [NAME] [PROPERTY]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "lightGetter"},
                }
              },
              {
                opcode: "setLightShadow",
                blockType: Scratch.BlockType.COMMAND,
                text: "set light [NAME] shadow [PROPERTY] to [VALUE]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "light" },
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "lightShadow"},
                  VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: "10"},
                }
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Sensing")},
                //is there a way to subdivide the bounding box into multiple ones for more precicion?
              {
                opcode: "touching",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "is [A] touching [B]?",
                arguments: {
                  A: { type: Scratch.ArgumentType.STRING, defaultValue: "object" },
                  B: { type: Scratch.ArgumentType.STRING, defaultValue: "ground"}
                }
              },

              "---",
              
              {blockType: "label",
              text: Scratch.translate("Audio")},
              {
                opcode: "loadAudio",
                blockType: Scratch.BlockType.COMMAND,
                text: "load audio [FILE] as [NAME]",
                color1: "#5FAD56",
                arguments: {
                  FILE: { type: Scratch.ArgumentType.SOUND },
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                }
              },
              {
                opcode: "addAudio",
                blockType: Scratch.BlockType.COMMAND,
                text: "add audio [NAME] to [PARENT]", 
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                  PARENT: { type: Scratch.ArgumentType.STRING, defaultValue: "bird"},
                }
              },
              {
                opcode: "doAudio",
                blockType: Scratch.BlockType.COMMAND,
                text: "for audio [NAME] [PROPERTY]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "audioPlayback"},
                }
              },
              {
                opcode: "setAudio",
                blockType: Scratch.BlockType.COMMAND,
                text: "set audio [NAME] [PROPERTY] to [DATA]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "audioNumeral"},
                  DATA: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1" }
                }
              },
              {
                opcode: "setAudioBoolean",
                blockType: Scratch.BlockType.COMMAND,
                text: "set audio [NAME] [PROPERTY] [DATA]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "audioBoolean"},
                  DATA: { type: Scratch.ArgumentType.NUMBER, menu: "boolean" }
                }
              },
              {
                opcode: "getAudio",
                blockType: Scratch.BlockType.REPORTER,
                text: "get audio [NAME] [PROPERTY]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "audioGetter"},
                }
              },
              {
                opcode: "isAudio",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "is audio [NAME] [PROPERTY]",
                color1: "#5FAD56",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "Whiz"},
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "isAudio"},
                }
              },
              {
                opcode: "stopAllAudios",
                blockType: "command",
                text: "stop all 3D audios",
                color1: "#C84630",               
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Raycast")},

              {
                opcode: "raycast",
                blockType: Scratch.BlockType.COMMAND,
                text: "raycast from [V] in direction [D] [ORDER]",
                arguments: {
                  V: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},
                  D: { type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},
                  ORDER: { type: Scratch.ArgumentType.STRING, menu: "XYZorder"},
                }
              },
              {
                opcode: "raycastCamera",
                blockType: Scratch.BlockType.COMMAND,
                text: "raycast from camera, mouse position [XY]",
                arguments: {
                  XY: { type: Scratch.ArgumentType.NUMBER, defaultValue: "[0,0]"},
                }
              },
              {
                opcode: "getRaycast",
                blockType: Scratch.BlockType.REPORTER,
                text: "get raycast [PROPERTY]",
                arguments: {
                  PROPERTY: { type: Scratch.ArgumentType.STRING, menu: "raycast"},
                }
              },
              {
                opcode: "isRaycast",
                blockType: Scratch.BlockType.BOOLEAN,
                text: "is raycast touching [NAME]",
                arguments: {
                  NAME: { type: Scratch.ArgumentType.STRING, defaultValue: "object"},
                }
              },

              "---",

              {blockType: "label",
              text: Scratch.translate("Addons")},

              {
                opcode: "orbitControls",
                blockType: Scratch.BlockType.COMMAND,
                text: "OrbitControls [MODE]",
                arguments: {
                  MODE: { type: Scratch.ArgumentType.STRING, menu: "boolean"},
                }
              },
              
              "---",

              {blockType: "label",
              text: Scratch.translate(`Physics, VR, Sky & Water, Postprocesing, +Addons (separate future extensions)`)},

              "---",
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
                { text: Scratch.translate("Random"), value: "randomDirection" },
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
                { text: Scratch.translate("Apply Euler"), value: "applyEuler" },
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
                {text: Scratch.translate("audios"), value: "audios"},
              ]},
              transformType: {
                items: [
                  {text: Scratch.translate("position"), value: "position"},
                  {text: Scratch.translate("rotation"), value: "rotation"},
                  {text: Scratch.translate("scale"), value: "scale"},
                ]
              },
              gettransformType: {
                items: [
                  {text: Scratch.translate("position"), value: "position"},
                  {text: Scratch.translate("rotation"), value: "rotation"},
                  {text: Scratch.translate("scale"), value: "scale"},
                  {text: Scratch.translate("World position"), value: "getWorldPosition"},
                  {text: Scratch.translate("World rotation"), value: "getWorldDirection"},
                  {text: Scratch.translate("World matrix"), value: "matrixWorld"},
                  {text: Scratch.translate("Local matrix"), value: "matrix"},
                ]
              },
              objectType: {
                items: [
                  {text: Scratch.translate("Mesh"), value: "Mesh"},
                  {text: Scratch.translate("Instanced Mesh"), value: "InstancedMesh"},
                  {text: Scratch.translate("Group"), value: "Group"},
                  {text: Scratch.translate("Sprite"), value: "Sprite"},
                  
                  {text: Scratch.translate("Points"), value: "Points"},

                  {text: Scratch.translate("Line"), value: "Line"},
                  {text: Scratch.translate("Line Loop"), value: "LineLoop"},
                  {text: Scratch.translate("Line Segments"), value: "LineSegments"},

                  {text: Scratch.translate("Ambient Light"), value: "AmbientLight"},
                  {text: Scratch.translate("Point Light"), value: "PointLight"},
                  {text: Scratch.translate("Directional Light"), value: "DirectionalLight"},
                  {text: Scratch.translate("Hemisphere Light"), value: "HemisphereLight"},
                  {text: Scratch.translate("Spot Light"), value: "SpotLight"},
                  {text: Scratch.translate("Rectangular Area Light"), value: "RectAreaLight"},

                  {text: Scratch.translate("Perspective Camera"), value: "PerspectiveCamera"},
                  {text: Scratch.translate("Orthographic Camera"), value: "OrthographicCamera"},
                  //{text: Scratch.translate("Cube Camera"), value: "CubeCamera"},
                ]
              },
              meshProperties: { items: [
                { text: Scratch.translate("Geometry"), value: "geometry" },
                { text: Scratch.translate("Material"), value: "material" },
              ]},
              meshBoolProperties: {items: [
                { text: Scratch.translate("Cast Shadow"), value: "castShadow" },
                { text: Scratch.translate("Receive Shadow"), value: "receiveShadow" },
                { text: Scratch.translate("Visible"), value: "visible" },
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
                { text: Scratch.translate("Cylinder"), value: "CylinderGeometry" },
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
                { text: Scratch.translate("Face Points (Normals) [XYZ]"), value: "normal" },
                { text: Scratch.translate("Vertex Colors [RGB]"), value: "color" },
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
                { text: Scratch.translate("Alpha Test"), value: "alphaTest" },
                { text: Scratch.translate("Roughness"), value: "roughness" },
                { text: Scratch.translate("Metalness"), value: "metalness" },
                { text: Scratch.translate("Emissive Intensity"), value: "emissiveIntensity" },
                { text: Scratch.translate("Reflectivity"), value: "reflectivity" },
                { text: Scratch.translate("Shininess"), value: "shininess" },
                { text: Scratch.translate("Physical: Transmission"), value: "transmission" },
                { text: Scratch.translate("Physical: Thickness"), value: "thickness" },
                { text: Scratch.translate("Refraction Ratio"), value: "refractionRatio" },
                { text: Scratch.translate("Polygon Offset Factor"), value: "polygonOffsetFactor" },
                { text: Scratch.translate("Polygon Offset Units"), value: "polygonOffsetUnits" },
                { text: Scratch.translate("Wireframe width"), value: "wireframeLinewidth" },
                { text: Scratch.translate("Points: Size"), value: "size" },
                { text: Scratch.translate("Physical: Anisotropy"), value: "anisotropy" },
                { text: Scratch.translate("Physical: Anisotropy Rotation"), value: "anisotropyRotation" },
                { text: Scratch.translate("Physical: Attenuation Distance"), value: "attenuationDistance" },
                { text: Scratch.translate("Bump Scale"), value: "bumpScale" },
                { text: Scratch.translate("Ambient Occlusion Texture Intensity"), value: "aoMapIntensity" },
              ]},
              materialBooleanProperties: { items: [
                { text: Scratch.translate("Visible"), value: "visible" },
                { text: Scratch.translate("Transparent"), value: "transparent" },
                { text: Scratch.translate("Wireframe"), value: "wireframe" },
                { text: Scratch.translate("Fog"), value: "fog" },
                { text: Scratch.translate("Allow Override Material"), value: "allowOverride" },
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
                { text: Scratch.translate("Sheen"), value: "sheen" },
                { text: Scratch.translate("Physical: Attenuation"), value: "attenuationColor" },
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
                { text: Scratch.translate("Physical: Anisotropy Texture"), value: "anisotropyMap" },
                { text: Scratch.translate("Displacement Texture"), value: "displacementMap" }
              ]},
              materialSides: { items: [
                { text: Scratch.translate("Front"), value: "0" },
                { text: Scratch.translate("Back"), value: "1" },
                { text: Scratch.translate("Double"), value: "2" },
              ]},
              materialBlending: { items: [
                { text: Scratch.translate("None"), value: "0" },
                { text: Scratch.translate("Normal"), value: "1" },
                { text: Scratch.translate("Additive"), value: "2" },
                { text: Scratch.translate("Subtractive"), value: "3" },
                { text: Scratch.translate("Multiply"), value: "4" },
                //{ text: Scratch.translate("Custom"), value: "5" }
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
              textureMapping: { items: [
                { text: Scratch.translate("UV (Standard)"), value: "300" },
                //{ text: Scratch.translate("Cube Reflection (6 images?)"), value: "301" },
                //{ text: Scratch.translate("Cube Refraction (6 images?)"), value: "302" },
                //{ text: Scratch.translate("Equirectangular Reflection (no diference)"), value: "303" },
                { text: Scratch.translate("Equirectangular"), value: "304" },
                //{ text: Scratch.translate("Cube UV Reflection (errors)"), value: "306" }
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
              rendererProperties: { items: [
                { text: Scratch.translate("Render Scene Automatically"), value: "autoRender" },
                { text: Scratch.translate("Clear All Automatically"), value: "autoClear" },
                { text: Scratch.translate("Clear Color Automatically"), value: "autoClearColor" },
                { text: Scratch.translate("Clear Depth Automatically"), value: "autoClearDepth" },
                { text: Scratch.translate("Shadows enabled"), value: "shadowMap.enabled" },
              ] },
              rendererGetProperties: {items: [
                { text: Scratch.translate("Render Scene Automatically"), value: "autoRender" },
                { text: Scratch.translate("Clear All Automatically"), value: "autoClear" },
                { text: Scratch.translate("Clear Color Automatically"), value: "autoClearColor" },
                { text: Scratch.translate("Clear Depth Automatically"), value: "autoClearDepth" },
                { text: Scratch.translate("Shadows enabled"), value: "shadowMap.enabled" },
              ]},
              shadowMapTypes: {items: [
                { text: Scratch.translate("Basic (Fastest)"), value: "0" },
                { text: Scratch.translate("Smooth (Default)"), value: "1" },
                { text: Scratch.translate("Expensive"), value: "2" },
                { text: Scratch.translate("Fabulous (Slowest)"), value: "3" },
              ]},
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
                { text: Scratch.translate("Intensity"), value: "intensity" },
                { text: Scratch.translate("Point, Spot: Distance"), value: "distance" },
                { text: Scratch.translate("Point, Spot: Decay"), value: "decay" },
                { text: Scratch.translate("Point, Spot, Rectangular: Power"), value: "power" },  
                { text: Scratch.translate("Spot: Angle"), value: "angle" },
                { text: Scratch.translate("Spot: Penumbra"), value: "penumbra" },
                { text: Scratch.translate("Rectangular: Width"), value: "width" },
                { text: Scratch.translate("Rectangular: Height"), value: "height" },
              ]},
              lightColors: {items: [
                { text: Scratch.translate("Color"), value: "color" },
                { text: Scratch.translate("Hemisphere: Sky Color"), value: "skyColor" },
                { text: Scratch.translate("Hemisphere: Ground Color"), value: "groundColor" },
              ]},
              lightStrings: {items: [
                { text: Scratch.translate("Spot: Texture"), value: "map" },
              ]},
              lightGetter: {items: [
                { text: Scratch.translate("Intensity"), value: "intensity" },
                { text: Scratch.translate("Color"), value: "color" },
                { text: Scratch.translate("Distance"), value: "distance" },
                { text: Scratch.translate("Decay"), value: "decay" },
                { text: Scratch.translate("Angle"), value: "angle" },
                { text: Scratch.translate("Penumbra"), value: "penumbra" },
                { text: Scratch.translate("Power"), value: "power" },
                { text: Scratch.translate("width"), value: "width" },
                { text: Scratch.translate("height"), value: "height" }         
              ]},
              lightShadow: {items: [
                { text: Scratch.translate("Scale"), value: "scale" },
                { text: Scratch.translate("Blur"), value: "radius" },
                { text: Scratch.translate("Instensity"), value: "intensity" }    
              ]},
              instanceItems: { items: [
                { text: Scratch.translate("matrix"), value: "matrix" },
                { text: Scratch.translate("color"), value: "color" },
              ]},
              reset: {items: [
                {text: Scratch.translate("everything"), value: "everything"},
                {text: Scratch.translate("objects"), value: "objects"},
                {text: Scratch.translate("geometries"), value: "geometries"},
                {text: Scratch.translate("materials"), value: "materials"},
                {text: Scratch.translate("textures"), value: "textures"},
                {text: Scratch.translate("audios"), value: "audios"},
              ]},
              stats: {items: [
                {text: Scratch.translate("memory"), value: "memory"},
                {text: Scratch.translate("render"), value: "render"},
              ]},
              audioNumeral: {items: [
                { text: Scratch.translate("Volume"), value: "setVolume" },
                { text: Scratch.translate("Speed"), value: "setPlaybackRate" },
                { text: Scratch.translate("Detune"), value: "setDetune" },
                { text: Scratch.translate("Volume Drop Distance (0.01-x)"), value: "setRefDistance" },
                { text: Scratch.translate("Max Distance"), value: "setMaxDistance" },
                { text: Scratch.translate("Fade Factor"), value: "setRolloffFactor" },
                //{ text: Scratch.translate("Loop start (seconds)"), value: "setLoopStart" },
                //{ text: Scratch.translate("Loop end (seconds)"), value: "setLoopEnd" },
                { text: Scratch.translate("Offset"), value: "offset" },
              ]},
              audioBoolean: {items: [
                //{ text: Scratch.translate("Autoplay"), value: "autoplay" },
                { text: Scratch.translate("Loop"), value: "setLoop" },
              ]},
              audioPlayback: {items: [
                { text: Scratch.translate("Play/Resume"), value: "play" },
                { text: Scratch.translate("Stop"), value: "stop" },
                { text: Scratch.translate("Pause"), value: "pause" },
              ]},
              isAudio: {items: [
                { text: Scratch.translate("playing"), value: "isPlaying" },
                { text: Scratch.translate("looping"), value: "loop" },               
              ]},
              audioGetter: {items: [
                { text: Scratch.translate("Volume"), value: "getVolume" },
                { text: Scratch.translate("Detune"), value: "getDetune" },
                { text: Scratch.translate("Speed"), value: "getPlaybackRate" },
                { text: Scratch.translate("Max Distance"), value: "getMaxDistance" },
                { text: Scratch.translate("Volume Drop Distance"), value: "getRefDistance" },
                { text: Scratch.translate("Fade Factor"), value: "getRolloffFactor" },      
              ]},
              raycast: {items: [
                { text: Scratch.translate("Distance"), value: "distance" },
                { text: Scratch.translate("Object"), value: "object" },
                { text: Scratch.translate("Point world coordinates"), value: "point" },
                { text: Scratch.translate("Normal"), value: "normal" },
                { text: Scratch.translate("InstancedMesh: Instance Id"), value: "instanceId" },
              ]},
              loadedModels: {items: () => {
                const s = runtime.extensionStorage[extensionID] || null;
                if (!s) {initStorage(); return [["waiting to load..."]];}
                const m = s.models;
                if (!m) {s.models = {}; m = {};}
                if (Object.keys(m).length == 0) return [["Load a model!"]];
                return Object.keys(m).map(x=>[x]);
              }}, 
              loadedFonts: {items: () => {
                const s = runtime.extensionStorage[extensionID] || null;
                if (!s) {initStorage(); return [["waiting to load..."]];}
                const m = s.fonts;
                if (!m) {s.fonts = {}; m = {};}
                if (Object.keys(m).length == 0) return [["Load a font!"]];
                return Object.keys(m).map(x=>[x]);
              }},
            },

          };
        }

        openExtra() {open("https://threejs.org/docs");}

        reset(args) {
          switch (args.VALUE) {
            case "everything":
              this.stopAllAudios();
              scene.children.forEach(
                o => {
                  //o.geometry ? o.geometry.dispose() : null;
                  //o.material ? o.material.dispose() : null;
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
              assets.addons.get("orbitControls") ? assets.addons.get("orbitControls").dispose() : null;

              assets.objects.clear();
              assets.geometries.clear();
              assets.materials.clear();
              assets.textures.clear();
              assets.addons.clear();
              assets.audios.clear();
              scene.clear();
              scene.fog = null;
              scene.overrideMaterial = null;
              camera = new THREE.PerspectiveCamera(90, width/height);
              camera.add(three.AudioListener);
              camera.position.z = 2;
              assets.objects.set("camera", camera);
              break;
            case "objects":
              assets.objects.forEach( o => o.removeFromParent() );
              assets.objects.clear();
              break;
            case "geometries":
              assets.geometries.forEach(
                o => o.dispose()
              );
              assets.geometries.clear();
              break;
            case "materials":
              assets.materials.forEach(
                o => o.dispose()
              );
              assets.materials.clear();
              break;
            case "textures":
              assets.textures.forEach(
                o => o.dispose()
              );
              assets.textures.clear();
              break;
            case "audios":
              assets.audios.clear();
              break;
          }

          three.renderer.clear();
        }

        stats(args) {
          return three.renderer.info[args.VALUE];
        }

        vector2(args) {return `[${args.X}, ${args.Y}]`;}
        vector3(args) {return `[${args.X}, ${args.Y}, ${args.Z}]`;}

        renderer(args) {
          const keys = args.PROPERTY.split(".");
          let current = three.renderer;
          for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]];
          if (!current) return;}

          if (args.PROPERTY == "autoRender") 
          {
            if (JSON.parse(args.VALUE)) loopId = requestAnimationFrame(loop);
            else {
              cancelAnimationFrame(loopId); 
              loopId = null;
            }
          } 
          else current[keys[keys.length - 1]] = JSON.parse(args.VALUE);
        }
        rendererClear(args) {
          three.renderer[args.B]();
          render();
        }
        rendererRender(args) {
          render(); //future physics, should change this to a step() method instead? or will it work like this?º
        }
        rendererShadow(args) {
          three.renderer.shadowMap.type = JSON.parse(args.PROPERTY);
        }
        getRenderer(args) {
          const keys = args.PROPERTY.split(".");
          let current = three.renderer;
          for (let i = 0; i < keys.length - 1; i++) { current = current[keys[i]];
          if (!current) return;}

          return current[keys[keys.length - 1]];
        }
        color(args) {return args.COLOR;}

        scene(args) {
          let value;
          if (args.PROPERTY == "overrideMaterial") {
            let material;
            if (args.VALUE == "null" || args.VALUE == "") {
              material = null;
            } else {
            material = assets.materials.get(args.VALUE);
            if (!material) {console.warn(`No material named ${args.VALUE}`); return;}
            }
            scene.overrideMaterial = material;
          }
          else if (args.PROPERTY == "fog") {
            args.VALUE == "[fog]" ?
            scene.fog = storedFog
            : scene.fog = null;
          }
          else {
            try { value = JSON.parse(args.VALUE); }
            catch {
              if (args.VALUE.at(0) == "#") value = new THREE.Color(args.VALUE);
              else value = assets.textures.get(args.VALUE); 
            }
            scene[args.PROPERTY] = value;
          }
          
        }
        getScene(args) {
          let value = scene[args.PROPERTY];
          if (value) {
            if (value.isColor) return "#" + value.getHexString();
            else return JSON.stringify(value);
          }
        }
        createFog(args) {
          storedFog = new THREE.Fog(args.COLOR, args.NEAR, args.FAR);
          return "[fog]"; //then the scene block will read for this and set the fog to the storedFog!
        }
        createFog2(args) {
          storedFog = new THREE.FogExp2(args.COLOR, args.DENSITY);
          return "[fog]";
        }

        deleteAsset(args) {
          const asset = assets[args.TYPE].get(args.NAME);
          if (!asset) {console.warn(`No asset named ${args.NAME}`); return;}
          switch (args.TYPE) {
            case "objects":
              asset.removeFromParent();
              break;
            default:  asset.dispose();
          }
           assets[args.TYPE].delete(args.NAME);
        }

        /*async*/ setTransform(args) {
          const obj = assets.objects.get(args.OBJECT);
          if (!obj) {console.warn(`No object named ${args.OBJECT}`); return;}

          let values = JSON.parse(args.VALUE);
          args.TRANSFORM == "rotation" ? values = values.map(a => THREE.MathUtils.degToRad(a)) : null;
          let v3 = new THREE.Vector3().fromArray(values);

          if (args.TRANSFORM == "rotation") {
            /*await*/ obj.rotation.setFromVector3(v3);
          } else /*await*/ obj[args.TRANSFORM].copy(v3);
        }

        getTransform(args) {
          const obj = assets.objects.get(args.OBJECT);
          if (!obj) {console.warn(`No object named ${args.OBJECT}`); return;}
          obj.updateMatrix();
          let v3;

          if (args.TRANSFORM == "getWorldPosition" || args.TRANSFORM == "getWorldDirection") {
            v3 = obj[args.TRANSFORM](new THREE.Vector3);
            v3.toArray();
          } else v3 = obj[args.TRANSFORM].toArray();
          args.TRANSFORM == "rotation" || args.TRANSFORM == "getWorldDirection" ? v3 = v3.slice(0,3).map(r=> THREE.MathUtils.radToDeg(r)) : null;

          return JSON.stringify(v3);
        }

        /*async*/ transformTransform(args) {
          const obj = assets.objects.get(args.OBJECT);
          if (!obj) {console.warn(`No object named ${args.OBJECT}`); return;}
          let v = args.VALUE;
          args.TRANSFORM == "rotation" ? v = THREE.MathUtils.degToRad(v) : null;
          /*await*/ args.ACTION == "set" ? obj[args.TRANSFORM][args.XYZ] = v : obj[args.TRANSFORM][args.XYZ] += v;
        }

        setRotation(args) {
          const obj = assets.objects.get(args.OBJECT);
          if (!obj) {console.warn(`No object named ${args.OBJECT}`); return;}
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
          if (args.OPERATION == "applyEuler") v2 = new THREE.Euler().fromArray(v2);
          else typeof(v2) == "number" ? null : v2 = new THREE.Vector3().fromArray(v2);
          let r = v1[args.OPERATION](v2);
          typeof(r) == "object" ? r = r.toArray() : null;
          return JSON.stringify(r);
        }

        moveVector(args) {
          let v3 = new THREE.Vector3().fromArray(JSON.parse(args.V));

          const [x,y,z] = JSON.parse(args.D);
          const euler = new THREE.Euler(
            THREE.MathUtils.degToRad(x), 
            THREE.MathUtils.degToRad(y), 
            THREE.MathUtils.degToRad(z), 
            args.ORDER
          );
          const direction = new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize();

          v3.add(direction.multiplyScalar(args.STEPS));
          return JSON.stringify(v3.toArray());
        }

        getVectorProjected(args) {
          const v3 = new THREE.Vector3().fromArray(JSON.parse(args.V));
          v3.project(camera);
          const v2 = new THREE.Vector2(...three.skin.size.map(m=>m/2));
          const r = [v3.x*v2.x, v3.y*v2.y];
          return JSON.stringify(r);
        }

        directionToVector(args) {
          const v1 = new THREE.Vector3().fromArray(JSON.parse(args.V1));
          const v2 = new THREE.Vector3().fromArray(JSON.parse(args.V2));

          const direction = v1.sub(v2).normalize();
          const pitch = THREE.MathUtils.radToDeg( Math.atan2(-direction.y, Math.sqrt(direction.x*direction.x + direction.z*direction.z)) );
          const yaw = THREE.MathUtils.radToDeg( Math.atan2(direction.x, direction.z) );

          return JSON.stringify([pitch,yaw,0]);
        }

        interpolateVectors(args) {
          const v1 = new THREE.Vector3().fromArray(JSON.parse(args.V1));
          const v2 = new THREE.Vector3().fromArray(JSON.parse(args.V2));
          const r = v1.lerp(v2, args.A/100);
          return JSON.stringify(r.toArray());
        }

        addObject(args) {
          if (this.objectExists({NAME: args.NAME})) {
            console.warn(`Already existing object named ${args.NAME}. Will replace!`);
            const obj = assets.objects.get(args.NAME);
            obj.removeFromParent();
          }
          const obj = new THREE[args.TYPE]();

          if (args.NAME == "scene") {console.warn(`Don't name objects "scene"!`); return;}

          assets.objects.set(args.NAME, obj);

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
              scene.add(obj.target);
              break;
          }

          if (!obj.isLight || obj.shadow) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
          if (obj.shadow) {
            obj.shadow.mapSize.width = 1024;
            obj.shadow.mapSize.height = 1024;
            obj.shadow.radius = 2;
            if (obj.shadow.map) {
              obj.shadow.map.dispose();
              obj.shadow.map = null;
            }
          }

          obj.name = args.NAME;
          
          const parent = assets.objects.get(args.PARENT);
          if (!parent) scene.add(obj);
          else parent.add(obj);
        }

        objectExists(args){
          if(assets.objects.get(args.NAME)) return true; 
          else return false;
        }

        setRenderingCamera(args){
          const selected = assets.objects.get(args.NAME);
          if (!selected) {console.warn(`No object named "${args.NAME}"`); return;}

          three.AudioListener.removeFromParent();
          selected.add(three.AudioListener);
          camera = selected;
        }

        camera() {return [...assets.objects.entries()].find(([key, value]) => value === camera)?.[0];}

        setObject(args) {
          let data;
          const obj = assets.objects.get(args.NAME);
          if (!obj) {console.warn(`No object named ${args.NAME}`); return;}

          switch (args.PROPERTY) {
            case "geometry":
              data = assets.geometries.get(args.DATA) || defaultGeo;
              obj.geometry = data;
              break;
            case "material":
              let material = args.DATA;
              data = [];
              try { material = JSON.parse(material);
              material.forEach(m=>data.push(assets.materials.get(m) || defaultMat));}
              catch {data = assets.materials.get(material) || defaultMat;}
              obj.material = data;
              obj.traverse(o=>o.material = data); //for models, not the best aproach but...
              break;
            default: obj[args.PROPERTY] = JSON.parse(args.DATA);
          }
        }
        setObjectBool(args) {
          const obj = assets.objects.get(args.NAME);
          if (!obj) {console.warn(`No object named ${args.NAME}`); return;}

          obj.traverse(o=>{o[args.PROPERTY] = JSON.parse(args.DATA);});
          obj[args.PROPERTY] = JSON.parse(args.DATA);
        }
        getObjectBool(args) {
          const obj = assets.objects.get(args.NAME);
          if (!obj) {console.warn(`No object named ${args.NAME}`); return;}

          return JSON.stringify(obj[args.PROPERTY]);
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
          if (!geometry) {console.warn(`No geometry named ${args.NAME}`); return;}

          let data, dataLength;
          data = JSON.parse(args.DATA); //.split(" ").map(p=>JSON.parse(p)).flat(); //from [0,0,0] [0,0,1] to 0,0,0,0,0,1

          switch (args.PROPERTY) {
            case "uv":
              dataLength = 2;
              break;
            default:
              dataLength = 3;
          }
          console.log(args.PROPERTY, new THREE.BufferAttribute(new Float32Array(data), dataLength))
          geometry.setAttribute(args.PROPERTY, new THREE.BufferAttribute(new Float32Array(data), dataLength));
        }
        getGeometry(args) {
          const geometry = assets.geometries.get(args.NAME);
          if (!geometry) {console.warn(`No geometry named ${args.NAME}`); return;}

          let a = geometry.getAttribute(args.PROPERTY);
          if (a) a=a.array; else return null;
          /* for custom output [0,0,0] [0,0,1] [1,0,1]
          const result = [];
          for (let i = 0; i < a.length; i += 3) {
              result.push([a[i],a[i+1],a[i+2]]);
          }

          return JSON.stringify(result).replaceAll("],", "] ").slice(1,-1);
          */
         return JSON.stringify(Object.values(a));
        }

        createMaterial(args) {
          let material = assets.materials.get(args.NAME);
          if (material) {
            console.warn(`Already existing material named ${args.NAME}. Will replace!`);
            material.dispose();
          }
          material = new THREE[args.TYPE]();
          assets.materials.set(args.NAME, material);
        }

        setMaterial(args) {
          const material = assets.materials.get(args.NAME);
          if (!material) {console.warn(`No material named ${args.NAME}`); return;}
          
          if (args.PROPERTY == "blending" && args.DATA > 2) {
            console.warn(`Premultiplied alpha is now on for material ${args.NAME}. Needed for blending type ${args.DATA}`);
            material.premultipliedAlpha = true;
          }
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
          if (!args.DATA) {console.warn(`No texture named ${args.DATA}`); return;}
          this.setMaterial(args);
        }
        setMaterialSide(args) {
          args.PROPERTY = "side";
          args.DATA = JSON.parse(args.DATA);
          this.setMaterial(args);
        }
        setMaterialBlending(args) {
          args.PROPERTY = "blending";
          args.DATA = JSON.parse(args.DATA);
          this.setMaterial(args);
        }
        setMaterialClipping(args) {
          args.PROPERTY = "side";

            let material = args.DATA;
            args.DATA = [];
            try { material = JSON.parse(material);
            material.forEach(m=>args.DATA.push(assets.objects.get(m) || null));}
            catch {args.DATA = assets.objects.get(material) || null;}
            
          this.setMaterial(args);
        }
        joinMaterial(args) {
          let m1 = args.MATERIAL;
          let m2 = args.MATERIAL2;
          try { m1 = JSON.parse(m1);}
          catch {m1 = [m1];}
          try { m2 = JSON.parse(m2);}
          catch {m2 = [m2];}
          m1.push(...m2);
          return JSON.stringify(m1);
        }

        async loadTexture(args) {
          const img = vm.editingTarget.getCostumes()[(vm.editingTarget.getCostumeIndexByName(args.COSTUME))].asset.encodeDataURI();
          const texture = await three.TextureLoader.loadAsync(img);
          texture.colorSpace = "srgb";
          assets.textures.set(args.NAME, texture);
        }

        setTextureWrap(args) {
          const texture = assets.textures.get(args.NAME);
          if (!texture) {console.warn(`No texture named ${args.NAME}`); return;}
          texture.wrapS = args.U;
          texture.wrapT = args.V;
          texture.needsUpdate = true;
        }

        setTextureFilter(args) {
          const texture = assets.textures.get(args.NAME);
          if (!texture) {console.warn(`No texture named ${args.NAME}`); return;}

          texture.magFilter = THREE[args.MAG];
          texture.minFilter = THREE[args.MIN];
          texture.needsUpdate = true;
        }

        setTexture(args) {
          const texture = assets.textures.get(args.NAME);
          if (!texture) {console.warn(`No texture named ${args.NAME}`); return;}

          let r = JSON.parse(args.VALUE);
          typeof(r) == "object" ? r = new THREE.Vector2().fromArray(r) : null;
          texture[args.PROPERTY] = r;
          texture.needsUpdate = true;
        }
        setTextureMapping(args) {
          const texture = assets.textures.get(args.NAME);
          if (!texture) {console.warn(`No texture named ${args.NAME}`); return;}

          texture.mapping = JSON.parse(args.VALUE);
          texture.needsUpdate = true;
        }

        setCamera(args) {
          const cam = assets.objects.get(args.NAME);
          if (!cam) {console.warn(`No camera named ${args.NAME}`); return;}

          if (cam.isCamera) {
            cam[args.PROPERTY] = JSON.parse(args.VALUE);
            cam.updateProjectionMatrix();
          } else console.error(`${args.NAME} is not a camera!`);
        }
        getCamera(args) {
          const cam = assets.objects.get(args.NAME);
          if (!cam) {console.warn(`No camera named ${args.NAME}`); return;}

          return JSON.stringify(cam[args.PROPERTY]);
        }

        setLight(args) {
          const light = assets.objects.get(args.NAME);
          if (!light) {console.warn(`No light named ${args.NAME}`); return;}

          let r = args.VALUE;
          if (light.isLight) {
            if (args.PROPERTY == "skyColor") { //hemisphere light needs reinit to set skycolor
            const light = assets.objects.get(args.NAME);
            if (!light) {console.warn(`No light named ${args.NAME}`); return;}

            assets.objects.delete(args.NAME);
            light.removeFromParent();

            const r = new THREE.HemisphereLight(args.VALUE, "#"+light.groundColor.getHexString(), light.intensity);
            light.dispose();

            assets.objects.set(args.NAME, r);
            r.name = args.NAME;
            scene.add(r);
          } else {
            //texture? color?
            args.PROPERTY == "map" ? r = assets.textures.get(args.VALUE) : typeof(r) == "string" && r.at(0) == "#" ? r = new THREE.Color(r) : r = JSON.parse(r);
            light[args.PROPERTY] = r;
          }
          } else console.error(`${args.NAME} is not a light!`);
        }
        setLightColor(args) {this.setLight(args);}
        setLightMap(args) {this.setLight(args);}
        setTargetLight(args) {
          const light = assets.objects.get(args.NAME);
          if (!light) {console.warn(`No light named ${args.NAME}`); return;}

          if (light.isSpotLight || light.isDirectionalLight ) {
            light.target.position.set(...JSON.parse(args.VALUE));
            light.target.updateMatrixWorld();
          } else console.error(`${args.NAME} is not a light or it's an invalid type!`);
        }
        getLight(args) {
          const light = assets.objects.get(args.NAME);
          if (!light) {console.warn(`No light named ${args.NAME}`); return;}

          if (args.PROPERTY == "color") return "#" + light.color.getHexString();
          return JSON.stringify(light[args.PROPERTY]);
        }
        setLightShadow(args) {
          const light = assets.objects.get(args.NAME);
          if (!light || !light.shadow) {console.warn(`No light named ${args.NAME}, or it doesn't support shadows!`); return;}

          const v = JSON.parse(args.VALUE);

          if (args.PROPERTY == "scale") {
            light.shadow.mapSize.width = 2**v; 
            light.shadow.mapSize.height = 2**v;
            if (light.shadow.map) {
              light.shadow.map.dispose();
              light.shadow.map = null;
            }
          }
          else light.shadow[args.PROPERTY] = v;
        }

        touching(args) {
          const oa = assets.objects.get(args.A);
          if (!oa) {console.warn(`No object named ${args.A}`); return;}
          const ob = assets.objects.get(args.B);
          if (!ob) {console.warn(`No object named ${args.B}`); return;}
          let a = new THREE.Box3().setFromObject( oa );
          let b = new THREE.Box3().setFromObject( ob );

          return a.intersectsBox(b);
        }

        orbitControls(args) {
          const oc = assets.addons.get("orbitControls");
          if (JSON.parse(args.MODE)) {
            oc ? oc.connect(renderer.canvas) : assets.addons.set("orbitControls", new OrbitControls(camera, renderer.canvas));
          } else { oc.disconnect(); oc.reset(); }
        }

        async loadModel() {
          const file = await requestFile(".glb,.gltf,.obj,.fbx");
          runtime.extensionStorage[extensionID].models[file.name] = file.url;
          console.log(`File ${file.name} has loaded and has been added!`);
        }
        async addModel(args) {
          if (args.NAME == "scene") {console.warn(`Don't name objects "scene"!`); return;}

          const url = runtime.extensionStorage[extensionID].models[args.FILE];
          if (!url) {console.warn(`No model named ${args.FILE}`); return;}

          let ext = args.FILE.split(".");
          ext = ext[ext.length-1];

          const response = await fetch(url);
          const file = await response.arrayBuffer();
          console.log(url, response, file);

          const group = new THREE.Group();
          group.name = args.NAME;
          if (assets.objects.get(args.NAME)) {
            console.warn(`Object named ${args.NAME} already exists! Will replace!`);
            assets.objects.get(args.NAME).removeFromParent();
          }
          assets.objects.set(args.NAME, group);
          scene.add(group);

          if (ext == "glb" || ext == "gltf") {

            three.GLTFLoad.parse(file, "", (obj) => add(obj));

          }
          else if (ext == "obj") {

            const data = new TextDecoder("utf-8").decode(file);
            add(three.OBJLoad.parse(data));

          } else if (ext == "fbx") {

            add(three.FBXLoad.parse(file));

          }

          function add(obj) {
            const model = obj.scene || obj;
            console.log(obj);
            group.add(model);
            group.traverse(o=>{o.castShadow = true; o.receiveShadow = true; console.log(o.material)});
          }

        }
        removeModel(args) {
          confirm(`Are you sure you want to delete ${args.FILE}?`) ? delete runtime.extensionStorage[extensionID].models[args.FILE] : null;
          vm.extensionManager.refreshBlocks();
        }

        createInstance(args) {
          if (args.NAME == "scene") {console.warn(`Don't name objects "scene"!`); return;}

          const g = assets.geometries.get(args.GEOMETRY) || defaultGeo;

          let material = args.MATERIAL;
          let mat = [];
              try { material = JSON.parse(material);
              material.forEach(m=>mat.push(assets.materials.get(m) || defaultMat));}
              catch {mat = assets.materials.get(material) || defaultMat;}

          const i = new THREE.InstancedMesh(g,mat,args.COUNT);
          i.instanceMatrix.setUsage( THREE.DynamicDrawUsage ); //should add a block to change this?? is it any harm leaving it like this?
          if (assets.objects.get(args.NAME)) {
            console.warn(`Object named ${args.NAME} already exists! Will replace!`);
            assets.objects.get(args.NAME).removeFromParent();
          }
          assets.objects.set(args.NAME, i);
          i.name = args.NAME;
          scene.add(i);
        }

        setInstance(args) {
          const i = assets.objects.get(args.NAME);
          if (!i) {console.warn(`No instance named ${args.NAME}`); return;}
          if (args.PROPERTY == "matrix") {
            const m = new THREE.Matrix4().fromArray(JSON.parse(args.MATRIX));
            i.setMatrixAt(args.INDEX-1, m);
            i.instanceMatrix.needsUpdate = true;
          } else {
            i.setColorAt(args.INDEX-1, new THREE.Color(args.MATRIX));
            i.instanceColor.needsUpdate = true;
          }
        }

        getMatrixTransform(args) {
          const m = new THREE.Matrix4().fromArray(JSON.parse(args.M));

          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();

          m.decompose(position, quaternion, scale);

          const decomposed = {
          "position": position,
          "rotation": quaternion,
          "scale": scale
          };
          let v3 = decomposed[args.TRANSFORM].toArray();
          args.TRANSFORM == "rotation" ? v3 = new THREE.Euler().setFromQuaternion(quaternion).toArray().slice(0,3).map(r => THREE.MathUtils.radToDeg(r)) : null;
          return JSON.stringify(v3); 
        }

        doMatrix(args) {
          const m = new THREE.Matrix4();
          const position = new THREE.Vector3().fromArray(JSON.parse(args.POSITION));
          const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray(JSON.parse(args.ROTATION).map(a => THREE.MathUtils.degToRad(a))));
          const scale = new THREE.Vector3().fromArray(JSON.parse(args.SCALE));

          m.compose(position, quaternion, scale);

          return JSON.stringify(m.elements);
        }

        async loadFont() {
          //get ttf file
          const file = await new Promise((resolve) => {
          const input = document.createElement("input");
            input.type = "file";
            input.accept = ".ttf";
            input.multiple = false;
            input.onchange = () => {
              resolve(input.files);
              input.remove();
            };
            input.click();
          });

          opentype ? null : opentype = await import("https://esm.sh/opentype.js");

          const url = await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => {
              const result = opentype.parse(fr.result);
              resolve(convertToFaceType(result));
            };
            fr.readAsArrayBuffer(file[0]);
          });
          //convert to json
          function convertToFaceType(font) {
/*
https://github.com/gero3/facetype.js
//Modified by Civero to match current compatibillity

The MIT License (MIT)

Copyright (c) 2016 gero3

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
                                              var scale = (1000 * 100) / ( (font.unitsPerEm || 2048) *72);
                                              var result = {};
                                              result.glyphs = {};

                                              for (let i = 0; i < font.glyphs.length; i++) {
                                                  const glyph = font.glyphs.get(i);
                                                  const unicodes = [];
                                                  if (glyph.unicode !== undefined) {
                                                      unicodes.push(glyph.unicode);
                                                  }
                                                  if (glyph.unicodes.length) {
                                                      glyph.unicodes.forEach(function(unicode){
                                                          if (unicodes.indexOf (unicode) == -1) {
                                                              unicodes.push(unicode);
                                                          }
                                                      });
                                                  }
                                                
                                                  unicodes.forEach(function(unicode){
                                                var glyphCharacter = String.fromCharCode (unicode);
                                                var needToExport = true;
                                                /*if (restriction.range !== null) {
                                                  needToExport = (unicode >= restriction.range[0] && unicode <= restriction.range[1]);
                                                } else if (restriction.set !== null) {
                                                  needToExport = (restrictCharacterSetInput.value.indexOf (glyphCharacter) != -1);
                                                }*/
                                                      if (needToExport) {

                                                  var token = {};
                                                  token.ha = Math.round(glyph.advanceWidth * scale);
                                                  token.x_min = Math.round(glyph.xMin * scale);
                                                  token.x_max = Math.round(glyph.xMax * scale);
                                                  token.o = "";
                                                  //if (reverseTypeface.checked) {glyph.path.commands = reverseCommands(glyph.path.commands);}
                                                  glyph.path.commands.forEach(function(command,i){
                                                    if (command.type.toLowerCase() === "c") {command.type = "b";}
                                                    token.o += command.type.toLowerCase();
                                                    token.o += " ";
                                                    if (command.x !== undefined && command.y !== undefined){
                                                      token.o += Math.round(command.x * scale);
                                                      token.o += " ";
                                                      token.o += Math.round(command.y * scale);
                                                      token.o += " ";
                                                    }
                                                    if (command.x1 !== undefined && command.y1 !== undefined){
                                                      token.o += Math.round(command.x1 * scale);
                                                      token.o += " ";
                                                      token.o += Math.round(command.y1 * scale);
                                                      token.o += " ";
                                                    }
                                                    if (command.x2 !== undefined && command.y2 !== undefined){
                                                      token.o += Math.round(command.x2 * scale);
                                                      token.o += " ";
                                                      token.o += Math.round(command.y2 * scale);
                                                      token.o += " ";
                                                    }
                                                  });
                                                  result.glyphs[String.fromCharCode(unicode)] = token;
                                                }
                                                  });
                                              }
                                              result.familyName = font.familyName;
                                              result.ascender = Math.round(font.ascender * scale);
                                              result.descender = Math.round(font.descender * scale);
                                              result.underlinePosition = Math.round(font.tables.post.underlinePosition * scale);
                                              result.underlineThickness = Math.round(font.tables.post.underlineThickness * scale);
                                              result.boundingBox = {
                                                  "yMin": Math.round(font.tables.head.yMin * scale),
                                                  "xMin": Math.round(font.tables.head.xMin * scale),
                                                  "yMax": Math.round(font.tables.head.yMax * scale),
                                                  "xMax": Math.round(font.tables.head.xMax * scale)
                                              };
                                              result.resolution = 1000;
                                              result.original_font_information = font.tables.name;
                                              if (font.names.fontSubfamily.en.toLowerCase().indexOf("bold") > -1){
                                                  result.cssFontWeight = "bold";
                                              } else {
                                                  result.cssFontWeight = "normal";
                                              }

                                              if (font.names.fontSubfamily.en.toLowerCase().indexOf("italic") > -1){
                                                  result.cssFontStyle = "italic";
                                              } else {
                                                  result.cssFontStyle = "normal";
                                              }
                                              
                                              return JSON.stringify(result);
          }

          runtime.extensionStorage[extensionID].fonts[file[0].name] = url;
          vm.extensionManager.refreshBlocks();
        }
        createTextGeometry(args) {
          const file = JSON.parse(runtime.extensionStorage[extensionID].fonts[args.FILE]);
          if (!file) {console.warn(`No font named ${args.FILE}`); return;}
          const font = three.TextLoader.parse(file);
          const geometry = new TextGeometry(args.TEXT, {
            font: font,
            size: 1,
            depth: args.DEPTH,
          });
          geometry.center();
          assets.geometries.set(args.NAME, geometry);
        }
        removeFont(args) {
          delete runtime.extensionStorage[extensionID].fonts[args.FILE];
        }

        async loadAudio(args) {
          const sounds = vm.editingTarget.getSounds();
          const file = sounds[sounds.findIndex(a=>a.name==args.FILE)].asset.data.buffer;

          const audioContext = THREE.AudioContext.getContext();
          const buffer = await audioContext.decodeAudioData(file.slice(0));

          assets.audios.set(args.NAME, buffer);
        }

        addAudio(args) {
          if (args.NAME == "scene") {console.warn(`Don't name objects "scene"!`); return;}

          const buffer = assets.audios.get(args.NAME);

          const sound = new THREE.PositionalAudio(three.AudioListener);
          sound.setBuffer(buffer);

          if (this.objectExists({NAME: args.NAME})) {
            console.warn(`Already existing object named ${args.NAME}. Will replace!`);
            const obj = assets.objects.get(args.NAME);
            obj.removeFromParent();
          }
          assets.objects.set(args.NAME, sound);

          const parent = assets.objects.get(args.PARENT);
          if (!parent) scene.add(sound);
          else parent.add(sound);
        }

        setAudio(args) {
          const sound = assets.objects.get(args.NAME);
          if (!sound) {console.warn(`No sound named ${args.NAME}`); return;}

          if (args.DATA == "offset") { sound.offset = JSON.parse(args.DATA); return;}
          args.DATA ? sound[args.PROPERTY](JSON.parse(args.DATA)) : sound[args.PROPERTY]();
        }
        doAudio(args) {this.setAudio(args);}
        setAudioBoolean(args) {this.setAudio(args);}

        isAudio(args) {
          const sound = assets.objects.get(args.NAME);
          if (!sound) {console.warn(`No sound named ${args.NAME}`); return;}

          return sound[args.PROPERTY];
        }
        getAudio(args) {
          const sound = assets.objects.get(args.NAME);
          if (!sound) {console.warn(`No sound named ${args.NAME}`); return;}

          return JSON.stringify(sound[args.PROPERTY]());}
        stopAllAudios() {
          assets.objects.forEach(
            a => {if (a.type == "Audio") {a.setLoopEnd(0); a.stop();}}
          );
        }

        raycast(args) {
          const v3 = new THREE.Vector3().fromArray(JSON.parse(args.V));
          const d3 = new THREE.Vector3(0,0,-1);
          const e = new THREE.Euler().fromArray(JSON.parse(args.D));
          e.order = args.ORDER;
          d3.applyEuler(e);

          storedRaycast = new THREE.Raycaster();
          storedRaycast.set(v3, d3);
        }
        raycastCamera(args) {
          const v2 = new THREE.Vector2().fromArray(JSON.parse(args.XY));
          storedRaycast = new THREE.Raycaster();
          storedRaycast.setFromCamera(v2, camera );
        }
        getRaycast(args) {
          const r = storedRaycast.intersectObject( scene );
          if (args.PROPERTY == "object") return JSON.stringify(r.map(i => i[args.PROPERTY].name));
          else if (args.PROPERTY == "point" || args.PROPERTY == "normal") return JSON.stringify(r.map(i => i[args.PROPERTY].toArray()));
          else return JSON.stringify(r.map(i => i[args.PROPERTY]));
        }
        isRaycast(args) {
          const obj = assets.objects.get(args.NAME);
          if (!obj) {console.warn(`No object named ${args.NAME}`); return;}

          const r = storedRaycast.intersectObject( obj );
          return r.length ? true : false;
        }
      
      }

      Scratch.extensions.register(new ThreeJS());
      loopId = requestAnimationFrame(loop);
      loop();

      function initStorage() {
        if (!runtime.extensionStorage[extensionID]) {
          runtime.extensionStorage[extensionID] = {
            models: {},
            fonts: {}
          };
        }
      }
      initStorage();

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
