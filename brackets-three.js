// Name: ThreeJS
// ID: masterMathThreeJS
// Description: An advanced 3D extension built on the popular Three.js library.
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// License: MIT

// Started October 21, 2025.

(async function(Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('This Hello World example must run unsandboxed');
  }

  const vm = Scratch.vm;
  const renderer = vm.renderer;
  const Cast = Scratch.Cast;

  const THREE = await Scratch.external.importModule('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.min.js');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, renderer.canvas.width / renderer.canvas.height, 0.1, 1000);
  camera.position.z = 5;

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  scene.add(new THREE.DirectionalLight(0xffffff, 0.5));

  let deltaTime = 0;
  let previousTime = 0;

  vm.runtime.on('BEFORE_EXECUTE', () => {
    const now = performance.now();

    if (previousTime === 0) {
      // First frame. We used to always return 0 here, but that can break projects that
      // expect delta time to always be non-zero. Instead we'll make our best guess.
      deltaTime = 1 / vm.runtime.frameLoop.framerate;
    } else {
      deltaTime = (now - previousTime) / 1000;
    }

    previousTime = now;
  });

  // Now that Three.js is loaded, create a stage layer to draw the rendered output to
  // Some of this skin class is based on the fantastic Simple3D extension
  class ThreeSkin extends Scratch.vm.renderer.exports.Skin {
    constructor(id, renderer) {
      super(id, renderer);
  
      this._renderer = renderer;
  
      const canvas = document.createElement('canvas');
      this._canvas = canvas;
  
      this.threeRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvas,
      });

      this.threeRenderer.setClearColor(0x000000, 0);
  
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
      renderer.on('NativeSizeChanged', this._boundOnNativeSizeChanged);
      this.resizeCanvas();
    }
  
    dispose() {
      this._renderer.removeListener('NativeSizeChanged', this._boundOnNativeSizeChanged);
      if (this._texture) this._renderer.gl.deleteTexture(this._texture);
      super.dispose();
    }
  
    get size() {
      return this._nativeSize;
    }
  
    getTexture() {
      return this._texture;
    }
  
    updateContent() {
      this.threeRenderer.render(scene, camera);
  
      const gl = this._renderer.gl;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this._canvas
      );
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  
      this.emitWasAltered();
    }
  
    resizeCanvas() {
      let w, h;
      if (this._renderer.useHighQualityRender) {
        w = this._renderer.canvas.width;
        h = this._renderer.canvas.height;
      } else {
        [w, h] = this._nativeSize;
      }
    
      this._canvas.width = w;
      this._canvas.height = h;
    
      this.threeRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    
      this.updateContent();
    }
  
    onNativeSizeChanged(event) {
      this._nativeSize = event.newSize;
      this._rotationCenter = [this._nativeSize[0] / 2, this._nativeSize[1] / 2];
      this.resizeCanvas();
    }
  } 

  // use the drawable order to create a new three drawable between the pen and video layers
  // It's wrapped in an IIFE for collapsibilitiy 
  (() => {
    let videoIndex = renderer._groupOrdering.indexOf('video');
    const groupName = 'threeJSLayer';
    renderer._groupOrdering.splice(videoIndex + 1, 0, groupName);
    renderer._layerGroups[groupName] = {
      groupIndex: videoIndex + 1,
      drawListOffset: renderer._layerGroups['video'].drawListOffset
    };
  
    renderer._groupOrdering.forEach((name, i) => {
      renderer._layerGroups[name].groupIndex = i;
    });
  
    const skinId = renderer._nextSkinId++;
    const skin = new ThreeSkin(skinId, renderer); // your Three.js skin
    renderer._allSkins[skinId] = skin;
  
    const drawableId = renderer.createDrawable(groupName);
    const drawable = renderer._allDrawables[drawableId];
    renderer.updateDrawableSkinId(drawableId, skinId);
  
    const originalDraw = renderer.draw;
  
    renderer.draw = function() {
      skin.updateContent();
      originalDraw.call(this);
    };
  
    drawable.setHighQuality = function (...args) {
      Object.getPrototypeOf(this).setHighQuality(...args);
      this.skin.resizeCanvas();
    }
  })();

  const objects = {};

  const geometries = {
    box: new THREE.BoxGeometry(),
    sphere: new THREE.SphereGeometry(),
    cone: new THREE.ConeGeometry(),
    cylinder: new THREE.CylinderGeometry(),
    torus: new THREE.TorusGeometry(),
  }

  const materials = {
    basic: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
    standard: new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    lambert: new THREE.MeshLambertMaterial({ color: 0x00ff00 }),
    phong: new THREE.MeshPhongMaterial({ color: 0x00ff00 }),
  }

  class ThreeJS {
    getInfo() {
      return {
        id: 'masterMathThree',
        name: 'ThreeJS',
        blocks: [
          {
            blockType: 'label',
            text: Scratch.translate('Objects'),
          },
          {
            opcode: 'createObject',
            blockType: Scratch.BlockType.COMMAND,
            text: Scratch.translate('create object [OBJECT]'),
            arguments: {
              OBJECT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: Scratch.translate('object'),
              }
            }
          },
          {
            opcode: "deleteObject",
            blockType: Scratch.BlockType.COMMAND,
            text: Scratch.translate("delete object [OBJECT]"),
            arguments: {
              OBJECT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: Scratch.translate('object'),
              }
            }
          },
          {
            blockType: 'label',
            text: Scratch.translate('Transformations'),
          },
          {
            opcode: "setTransform",
            blockType: Scratch.BlockType.COMMAND,
            text: Scratch.translate("set [TRANSFORM] of [OBJECT] to x: [X] y: [Y] z: [Z]"),
            arguments: {
              OBJECT: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: Scratch.translate('object'),
              },
              TRANSFORM: {
                type: Scratch.ArgumentType.STRING,
                menu: 'transforms',
                defaultValue: 'position',
              },
              X: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0,
              },
              Y: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0,
              },
              Z: {
                type: Scratch.ArgumentType.NUMBER,
                defaultValue: 0,
              },
            },
          },
        ],
        menus: {
          transforms: {
            acceptReporters: true,
            items: [
              {
                text: Scratch.translate('position'),
                value: 'position',
              },
              {
                text: Scratch.translate('rotation'),
                value: 'rotation',
              },
              {
                text: Scratch.translate('scale'),
                value: 'scale',
              },
            ],
          },
        },
      };
    }

    createObject({ OBJECT }) {
      const geometry = geometries.box;
      const material = materials.standard;
      const object = new THREE.Mesh(geometry, material);
      scene.add(object);
      objects[OBJECT] = object;
    }

    deleteObject({ OBJECT }) {
      const object = objects[OBJECT];
      if (object) {
        scene.remove(object);
        delete objects[OBJECT];
      }
    }

    setTransform({ OBJECT, TRANSFORM, X, Y, Z }) {
      (TRANSFORM === 'rotation') ? 
        objects[OBJECT]?.[TRANSFORM].set(
          THREE.MathUtils.degToRad(X),
          THREE.MathUtils.degToRad(Y),
          THREE.MathUtils.degToRad(Z)
        )
      : objects[OBJECT]?.[TRANSFORM].set(X, Y, Z);
    }

  }

  Scratch.extensions.register(new ThreeJS());
})(Scratch);
