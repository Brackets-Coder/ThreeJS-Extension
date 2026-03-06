import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGL from 'three/addons/capabilities/WebGL.js';

if (WebGL.isWebGL2Available()) {

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const pixelRatio = window.devicePixelRatio;
    const width = Math.floor(canvas.clientWidth * pixelRatio);
    const height = Math.floor(canvas.clientHeight * pixelRatio);
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  //* =-=-=-=-=-=| SCENE SETUP |=-=-=-=-=-=
  const canvas = document.querySelector('#c');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

  const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 999);
  camera.position.z = 5;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  const scene = new THREE.Scene();

  const light = new THREE.DirectionalLight(0xFFFFFF, 3);
  light.position.set(0, 1, 4);
  scene.add(light);

  const AmbientLight = new THREE.AmbientLight(0xefefef);
  scene.add(AmbientLight);

  scene.background = new THREE.Color(0x202020);
  //* =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

  const grid = new THREE.GridHelper(10, 10, 0x999999, 0x808080);
  scene.add(grid);

  //* =-=-=-=-=-=| RENDER LOOP |=-=-=-=-=-=
  function render() {

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

} else {
  const warning = WebGL.getWebGL2ErrorMessage();
  document.body.appendChild(warning);
}