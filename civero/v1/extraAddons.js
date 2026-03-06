// Name: Extra 3D Addons
// ID: threejsAddonsExtension
// Description: Extension for extra3D extension, addons
// By: Civero <https://scratch.mit.edu/users/civero/> <https://civero.itch.io> <https://civ3ro.github.io/extensions>
// License: MIT License Copyright (c) 2021-2024 TurboWarp Extensions Contributors

(function (Scratch) {
"use strict";

  if (!Scratch.extensions.unsandboxed) {throw new Error("Extension must run unsandboxed")}
  if (!Scratch.vm.extensionManager._loadedExtensions.has("threejsExtension")) throw new Error("Load Extra 3D first! This extension adds Addons, this is not the main one.")
  
  const vm = Scratch.vm
  const runtime = vm.runtime
  const Cast = Scratch.Cast
  console.log('Loading Extra3D Addons')

  const THREE = _Extra3D_.THREE

  //Addons
  let GLTFLoader
  let gltf
  let BufferGeometryUtils

  let composer
  let customEffects = []
  let models = {}

  let 
    EffectComposer,
    EffectPass,
    RenderPass,

    Effect,
    BloomEffect,
    GodRaysEffect,
    DotScreenEffect,
    DepthOfFieldEffect,

    BlendFunction;

  function resetComposer() {
    composer.reset()
    composer.passes = []
    customEffects = []
    updateComposer()
  }
  function updateComposer() {
    if (!_Extra3D_.CAMERA || !_Extra3D_.SCENE) return

    const Render = new RenderPass(_Extra3D_.SCENE, _Extra3D_.CAMERA)
    if (!composer.passes.some(p => p && p._Extra3D_.SCENE)) composer.addPass(Render) //add
    else { //replace it to current scene&camera
      const idx = composer.passes.findIndex(p => p && p._Extra3D_.SCENE);
      composer.passes[idx] = Render;
    }
  }

  function getModel(model, name) {
    const file = runtime.getTargetForStage().getSounds().find(c => c.name === model)
    if (!file) return

  return new Promise((resolve, reject) => {
      gltf.parse(
        file.asset.data.buffer,
        "",
        gltf => {
          const root = gltf.scene
          root.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          });

          const mixer = new THREE.AnimationMixer(root)
          const actions = {}
          gltf.animations.forEach(clip => {
            const act = mixer.clipAction(clip)
            act.clampWhenFinished = true
            actions[clip.name] = act
          });

          models[name] = { root, mixer, actions }
          resolve(root)
        },
        error => {
          console.error("Error parsing GLB model:", error)
          reject(error)
        }
      )})
  }
  async function openFileExplorer(format) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
        input.type = "file"
        input.accept = format
        input.multiple = false
        input.onchange = () => {
          resolve(input.files)
          input.remove()
        };
        input.click();
    })
  }
  async function load() {
    GLTFLoader = await import("https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js")
    gltf = new GLTFLoader.GLTFLoader()

    BufferGeometryUtils = await import("https://esm.sh/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js")

    const POSTPROCESSING = await import("https://esm.sh/postprocessing@6.37.8"); //damm only case i do need to add semicolon
    ({
      EffectComposer,
      EffectPass,
      RenderPass,

      Effect,
      BloomEffect,
      GodRaysEffect,
      DotScreenEffect,
      DepthOfFieldEffect,

      BlendFunction
    } = POSTPROCESSING)

    // Example: create a composer
    composer = new EffectComposer(_Extra3D_.THREERENDERER, {frameBufferType: THREE.HalfFloatType})

    Object.defineProperties(_Extra3D_, {
      COMPOSER: { get: () => composer, enumerable: true, configurable: true },
      CustomEffects: { get: () => customEffects, configurable: true }
    })

    _Extra3D_.resetComposer = resetComposer
    _Extra3D_.updateComposer = updateComposer

    _Extra3D_.onUpdate.push(loop)
  }
  const loop = (delta) => {
    if (_Extra3D_.SCENE && _Extra3D_.CAMERA) {

      Object.values(models).forEach( model => { if (model) model.mixer.update(delta) } )

      if (_Extra3D_.CustomEffects) _Extra3D_.CustomEffects.forEach(e => {
        if (e.uniforms.get('time')) {
        e.uniforms.get('time').value += delta
        }
      })
    }
  }

  Promise.resolve(load()).then(() => {

    class ThreeAddons {
    getInfo() {
        return {
        id: "threeAddons",
        name: "Extra 3D Addons",
        color1: "#c538a2ff",
        color2: "#222222",
        color3: "#222222",

        blocks: [
            {blockType: Scratch.BlockType.LABEL, text: "GLB Model Importing"},
            {blockType: Scratch.BlockType.BUTTON, text: "Load GLB File", func: "loadModelFile"},
            {opcode: "addModel", blockType: Scratch.BlockType.COMMAND, text: "add [ITEM] as [NAME] to [GROUP]", arguments: {GROUP: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"},ITEM: {type: Scratch.ArgumentType.STRING, menu: "modelsList"}, NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myModel"}}},
            {opcode: "getModel", blockType: Scratch.BlockType.REPORTER, text: "get object [PROPERTY] of [NAME]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myModel"}, PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "modelProperties"}}},
            {opcode: "playAnimation", blockType: Scratch.BlockType.COMMAND, text: "play animation [ANAME] of [NAME], [TIMES] times", arguments: {TIMES: {type: Scratch.ArgumentType.NUMBER, defaultValue: "0"}, NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myModel"}, ANAME: {type: Scratch.ArgumentType.STRING, defaultValue: "walk",exemptFromNormalization: true}}},
            {opcode: "pauseAnimation", blockType: Scratch.BlockType.COMMAND, text: "set [TOGGLE] animation [ANAME] of [NAME]", arguments: {TOGGLE: {type: Scratch.ArgumentType.NUMBER, menu: "pauseUn"}, NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myModel"}, ANAME: {type: Scratch.ArgumentType.STRING, defaultValue: "walk",exemptFromNormalization: true}}},
            {opcode: "stopAnimation", blockType: Scratch.BlockType.COMMAND, text: "stop animation [ANAME] of [NAME]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myModel"}, ANAME: {type: Scratch.ArgumentType.STRING, defaultValue: "walk",exemptFromNormalization: true}}},
            {opcode: "splineModel", extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "create (geometry&material) spline [NAME] using model [MODEL] along curve [CURVE] with spacing [SPACING]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "mySpline"}, MODEL: {type: Scratch.ArgumentType.STRING, menu: "modelsList"}, CURVE: {type: Scratch.ArgumentType.STRING, defaultValue: "[curve]", exemptFromNormalization: true}, SPACING: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1}}},

            {blockType: Scratch.BlockType.LABEL, text: "Post Processing"},
            {opcode: "resetComposer", blockType: Scratch.BlockType.COMMAND, text: "reset composer"},
            {opcode: "bloom", blockType: Scratch.BlockType.COMMAND, text: "add bloom intensity:[I] smoothing:[S] threshold:[T] | blend: [BLEND] opacity:[OP]", arguments: {OP: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1},I: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1}, S:{type: Scratch.ArgumentType.NUMBER, defaultValue: 0.5}, T:{type: Scratch.ArgumentType.NUMBER, defaultValue: 0.5}, BLEND: {type: Scratch.ArgumentType.STRING, menu: "blendModes", defaultValue: "SCREEN"}}},
            {opcode: "godRays", blockType: Scratch.BlockType.COMMAND, text: "add god rays object:[NAME] density:[DENS] decay:[DEC] weight:[WEI] exposition:[EXP] | resolution:[RES] samples:[SAMP] | blend: [BLEND] opacity:[OP]", arguments: {OP: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1},NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"},BLEND: {type: Scratch.ArgumentType.STRING, menu: "blendModes", defaultValue: "SCREEN"}, DEC:{type: Scratch.ArgumentType.NUMBER, defaultValue: 0.95}, DENS:{type: Scratch.ArgumentType.NUMBER, defaultValue: 1},EXP:{type: Scratch.ArgumentType.NUMBER, defaultValue: 0.1},WEI:{type: Scratch.ArgumentType.NUMBER, defaultValue: 0.4},RES:{type: Scratch.ArgumentType.NUMBER, defaultValue: 1},SAMP:{type: Scratch.ArgumentType.NUMBER, defaultValue: 64},}},
            {opcode: "dots", blockType: Scratch.BlockType.COMMAND, text: "add dots scale:[S] angle:[A] | blend: [BLEND] opacity:[OP]", arguments: {OP: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1},S:{type: Scratch.ArgumentType.NUMBER, defaultValue: 1}, A: {type: Scratch.ArgumentType.ANGLE, defaultValue: 0},BLEND: {type: Scratch.ArgumentType.STRING, menu: "blendModes", defaultValue: "SCREEN"}}},
            {opcode: "depth", blockType: Scratch.BlockType.COMMAND, text: "add depth of field focusDistance:[FD] focalLength:[FL] bokehScale:[BS] | height:[H] | blend: [BLEND] opacity:[OP]", arguments: {FD: {type: Scratch.ArgumentType.NUMBER, defaultValue: (3)},FL: {type: Scratch.ArgumentType.NUMBER, defaultValue: (0.001)},BS: {type: Scratch.ArgumentType.NUMBER, defaultValue: 4},H: {type: Scratch.ArgumentType.NUMBER, defaultValue: 240},OP: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1},BLEND: {type: Scratch.ArgumentType.STRING, menu: "blendModes", defaultValue: "NORMAL"}}},
            "---",
            {opcode: "custom", blockType: Scratch.BlockType.COMMAND, text: "add custom shader [NAME] with GLSL fragm [FRA] vert [VER] | blend: [BLEND] opacity:[OP]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myShader"}, FRA: {type: Scratch.ArgumentType.STRING}, VER: {type: Scratch.ArgumentType.STRING}, BLEND: {type: Scratch.ArgumentType.STRING, menu: "blendModes", defaultValue: "NORMAL"}, OP: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1}}},
            ],
        menus: {            
            onoff: {acceptReporters: true, items: [{text: "enabled", value: "1"},{text: "disabled", value: "0"},]},
            blendModes: {acceptReporters: false, items: [
            "SKIP","SET","ADD","ALPHA","AVERAGE","COLOR","COLOR_BURN","COLOR_DODGE",
            "DARKEN","DIFFERENCE","DIVIDE","DST","EXCLUSION","HARD_LIGHT","HARD_MIX",
            "HUE","INVERT","INVERT_RGB","LIGHTEN","LINEAR_BURN","LINEAR_DODGE",
            "LINEAR_LIGHT","LUMINOSITY","MULTIPLY","NEGATION","NORMAL","OVERLAY",
            "PIN_LIGHT","REFLECT","SCREEN","SRC","SATURATION","SOFT_LIGHT","SUBTRACT",
            "VIVID_LIGHT"
            ]},
            modelProperties: {acceptReporters: false, items: [
                {text: "Animations", value: "animations"},
            ]},
            pauseUn: {acceptReporters: true, items: [{text: "Pause", value: "true"},{text: "Unpasue", value: "false"},]},
            modelsList: {acceptReporters: false, items: () => {
                const stage = runtime.getTargetForStage();
                if (!stage) return ["(loading...)"];

                // @ts-ignore
                const models = Scratch.vm.runtime.getTargetForStage().getSounds().filter(e => e.name && e.name.endsWith('.glb'))
                if (models.length < 1) return [["Load a model!"]]
                    
                // @ts-ignore
                return models.map( m =>  [m.name] )
            }},
        }
        }}

    resetComposer() {
      resetComposer()
    }

    bloom(args) {
    if (!_Extra3D_.CAMERA || !_Extra3D_.SCENE) return
    const bloomEffect = new BloomEffect({
        intensity: args.I,
        luminanceThreshold: args.T,   // ← correct key
        luminanceSmoothing: args.S,
        blendFunction: BlendFunction[args.BLEND],
    })
    bloomEffect.blendMode.opacity.value = args.OP

    const pass = new EffectPass(_Extra3D_.CAMERA, bloomEffect)

    composer.addPass(pass)
    }

    godRays(args) {
    if (!_Extra3D_.CAMERA || !_Extra3D_.SCENE) return
        let object = _Extra3D_.getObject(args.NAME)
        const sun = object

        const godRays = new GodRaysEffect(_Extra3D_.CAMERA, sun, {
        resolutionScale: args.RES,
        density: args.DENS,           // ray density
        decay: args.DEC,             // fade out
        weight: args.WEI,             // brightness of rays
        exposure: args.EXP,
        samples: args.SAMP,
        blendFunction: BlendFunction[args.BLEND],
        })
        godRays.blendMode.opacity.value = args.OP
        const pass = new EffectPass(_Extra3D_.CAMERA, godRays)
        composer.addPass(pass)
    }

    dots(args) {
    if (!_Extra3D_.CAMERA || !_Extra3D_.SCENE) return
        const dot = new DotScreenEffect({
        angle: args.A,
        scale: args.S,
        blendFunction: BlendFunction[args.BLEND],
        })
        dot.blendMode.opacity.value = args.OP
        const pass = new EffectPass(_Extra3D_.CAMERA, dot)
        composer.addPass(pass)
    }

    depth(args) {
        if (!_Extra3D_.CAMERA || !_Extra3D_.SCENE) return
        const dofEffect = new DepthOfFieldEffect(_Extra3D_.CAMERA, {
        focusDistance: (args.FD - _Extra3D_.CAMERA.near) / (_Extra3D_.CAMERA.far - _Extra3D_.CAMERA.near),     // how far from camera things are sharp (0 = near, 1 = far)
        focalLength: args.FL,      // lens focal length in meters
        bokehScale: args.BS,      // strength/size of the blur circles
        height: args.H,          // resolution hint (affects quality/perf)
        blendFunction: BlendFunction[args.BLEND],
        })
        dofEffect.blendMode.opacity.value = args.OP

        const dofPass = new EffectPass(_Extra3D_.CAMERA, dofEffect)
        composer.addPass(dofPass)
    }

    async custom(args) {
        function cleanGLSL(glslCode) {
        //delete multilines comments
        let cleanedCode = glslCode.replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/  /g, '\n')
        .replace(/\/\/.*$/gm, ' ')
        .replace(/; /g, ';\n')
        
        return cleanedCode;
        }

        let fs = cleanGLSL(`
        ${args.FRA}
        `)
        if (!args.FRA.trim()) {fs = `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = inputColor; }`}
        const vs = cleanGLSL(`
        ${args.VER}
        `)
        console.log(fs)
        console.log(vs)

        const effect = new Effect(
        "Custom", 
        fs, 
        {
            blendFunction: BlendFunction[args.BLEND],
            vertexShader: vs,
            uniforms: new Map([ //uniforms usually in shaders... open to more!
            ['time', new THREE.Uniform(0.0)], 
            ['resolution', new THREE.Uniform(new THREE.Vector2(_Extra3D_.THREERENDERER.domElement.width, _Extra3D_.THREERENDERER.domElement.height))] 
            ]),
            defines: new Map([['USE_TIME', '1'], ['USE_VERTEX_TRANSFORM', '']]),
        }
        );

        effect.blendMode.opacity.value = args.OP

        const pass = new EffectPass(_Extra3D_.CAMERA, effect);
        composer.addPass(pass);

        customEffects.push(effect);
    }

        async loadModelFile() {

        openFileExplorer(".glb").then(files => {
        const file = files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            
        { // From lily's assets

                // Thank you PenguinMod for providing this code.
            {
            const targetId = runtime.getTargetForStage().id; //util.target.id not working!
            const assetName = Cast.toString(file.name);

            //const res = await Scratch.fetch(args.URL);
            //const buffer = await res.arrayBuffer();
            const buffer = arrayBuffer

            const storage = runtime.storage;
            const asset = storage.createAsset(
                storage.AssetType.Sound,
                storage.DataFormat.MP3,
                // @ts-ignore
                new Uint8Array(buffer),
                null,
                true
            );

            try {
                await vm.addSound(
                // @ts-ignore
                {
                    asset,
                    md5: asset.assetId + "." + asset.dataFormat,
                    name: assetName,
                },
                targetId
                );
                alert("Model loaded successfully!");
            } catch (e) {
                console.error(e);
                alert("Error loading model.");
            }
            }
            // End of PenguinMod
        }
        };

        reader.readAsArrayBuffer(file);
        })

    }
    async addModel(args) {
        const group = await getModel(args.ITEM, args.NAME)

        _Extra3D_.createObject(args.NAME, group, args.GROUP)
    }
    getModel(args){
        if (!models[args.NAME]) return;
        return Object.keys(models[args.NAME].actions).toString()
    }
    playAnimation(args) {
        const model = models[args.NAME]
        if (!model) {console.log("no model!"); return}

        const action = model.actions[args.ANAME] //clones of models dont have a stored actions!
        if (!action) {
        console.log("no action!")
        return
        }

        args.TIMES > 0 ? action.setLoop(THREE.LoopRepeat, args.TIMES) : action.setLoop(THREE.LoopRepeat, Infinity)

        action.reset()
        .play()
    }
    stopAnimation(args) {
        const model = models[args.NAME];
        if (!model) return;

        const action = model.actions[args.ANAME];
        if (action) action.stop();
    }
    pauseAnimation(args) {
        const model = models[args.NAME];
        if (!model) return;

        const action = model.actions[args.ANAME];
        if (action) action.paused = args.TOGGLE
    }

    async splineModel(args) {
        const model = await getModel(args.MODEL, args.NAME)
        if (!model) return console.warn("Model not found:", args.MODEL)

        const curve = _Extra3D_.getAsset(args.CURVE)
        const spacing = parseFloat(args.SPACING) || 1
        const curveLength = curve.getLength()
        const divisions = Math.floor(curveLength / spacing)

        const geomList = []
        const matList = []

        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions
            const pos = curve.getPointAt(t)
            const tangent = curve.getTangentAt(t)

            const temp = model.clone(true)
            temp.position.copy(pos)

            const up = new THREE.Vector3(0, 0, 1)
            const quat = new THREE.Quaternion().setFromUnitVectors(up, tangent.clone().normalize())
            temp.quaternion.copy(quat)

            temp.updateMatrixWorld(true)

            temp.traverse(child => {
                if (child.isMesh && child.geometry) {
                const geom = child.geometry.clone()
                geom.applyMatrix4(child.matrixWorld)
                geomList.push(geom)
                matList.push(child.material) //.clone() ?
                }
            })
        }

        const validGeoms = geomList.filter(g => {
            const ok = g && g.isBufferGeometry && g.attributes && g.attributes.position
            if (!ok) console.warn("geometry skipped:", g)
            return ok
        })

        const merged = BufferGeometryUtils.mergeGeometries(validGeoms, true)
        merged.computeBoundingBox()
        merged.computeBoundingSphere()

        merged.name = args.NAME
        _Extra3D_.GEOMETRIES[args.NAME] = merged
        matList.name = args.NAME
        _Extra3D_.MATERIALS[args.NAME] = matList
    }

    }

    Scratch.extensions.register(new ThreeAddons())

  })

})(Scratch);