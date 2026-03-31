// Name: ThreeJS Virtual Reality Addon
// ID: turboThree
// Description: Blocks that enable vr content for Three js!
// By: Civero <https://scratch.mit.edu/users/Civero/>
// License: MPL-2.0 and MIT

// Started 19 March 2026

/* TODO: 
    When button (x) of controller (right) event
    Blocks will fail if xr not supported, add fail prevention
    is it possible to use this in phones? ar, displaying models irl??
*/

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

  const extensionID = "threejsVRAddon";
  const extensionIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASkAAADfCAYAAACqJSUyAAAMl0lEQVR4AezdiXLbOhIFUL/5/3/OGE6Y0BYpblgawHGFkcwFaJyGrj2pmnr/+/BFgACBwAJCKnBzlEaAwMeHkLILCBAILSCkQrenfnFmJBBNQEhF64h6CBD4JiCkvnH4hgCBaAJCKlpH1EMgkkCAWoRUgCYogQCBfQEhtW/jCgECAQSEVIAmKIEAgX0BIbVvU/+KGQkQeBEQUi8kThAgEElASEXqhloIEHgREFIvJE4QiCKgjiQgpJKCgwCBsAJCKmxrFEaAQBIQUknBQYBAWAEh9bc13hAgEFFASEXsipoIEPgrIKT+UnhDgEBEASEVsStqiiCghiACQipII5RBgMC2gJDadnGWAIEgAkIqSCOUQYDAtkCUkNquzlkCBKYXEFLTbwEABGILCKnY/VEdgekFhNT0WyAmgKoILAJCapHwSoBASAEhFbItiiJAYBEQUouEVwIEQgp8hVTIyhRFgACBTwEh9YngDwECcQVChdQvXwQIhBNoHV9hQip1pjWG+f8IeCGwEmj92WwaUmnxy7Ey8ZYAgWACy+c0vdYurVlItVhsbVzzERhRoPZnt2pIpcUtx4jNsyYCYwq8rmr5HKfX16t5z1QLqRqLyUtjNAIEzgiU/mxXCanSizgD6R4CBMoJlPyMFw+pksWXIzcyAQJXBUp91ouGVKmir+L1db9qCfQrUOIzXyykShTbb+tUTmAegdyf/SIhlbvIedprpQTGEMiZAdlDKmdxY7TLKgg8Euj24VxZkDWkchXVbVcUToDAN4EcmZA1pL5V5xsCBAhkEBBSGRANQYDAvsDT36aE1Hdb3xEgUEDgSVBlC6knRRQwMSQBAoMIZAkpATXIbrAMAgEFsoRUwHUpiUAWAYO0FxBS7XugAgIE3ggIqTc4LhEg0F5ASLXvgQoIEHgjECqk3tTpEgECkwoIqUkbb9kEehEQUr10Sp0EJhUQUpM2votlK5LAp4CQ+kTwhwCBuAJCKm5vVEaAwKeAkPpE8IcAgbgC/0Iqbo0qI0BgYgEhNXHzLZ1ADwJCqocuqZHAxAJCauLmv1+6qwRiCAipGH1QBQECOwJCagfGaQIEYggIqRh9UAWB6ALN6hNSzehNTIDAGQEhdUbJPQQINBMQUs3oTUyAwBkBIXVGqf49ZiRA4I+AkPoD4YUAgZgCQipmX1RFgMAfASH1B8ILgcgCM9cmpGbuvrUT6EBASHXQJCUSmFlASM3cfWsn0IGAkNpoklMECMQREFJxeqESAgQ2BITUBopTBAjEERBScXqhkqgC6moqIKSa8pucAIEjASF1JOQ6AQJNBYRUU36TEyBwJBAvpI4qdp0AgakEhNRU7bZYAv0JCKn+eqZiAlMJCKlK7f7v4KtSGR1OE6Pkg/b9F6PKMasQUhX6mjb40TRn7jkaw/UyAmd6c+aeMtWNP6qQKtDjtGHXx9kp1s+s35993n15BNb26f3ZUdO9W8fZ5923LSCktl1un02b9PbDOw+WGHNnqulPl7AuMeZMjfoRUjMtPc9a0wZcH3lGfR1lmeP1ijM5BEr7lh4/h0HUMYTUzc602nSt5r3JFPaxxXF5rVVo7flqravkPELqhm7aaDcey/pIhBqyLqjiYBHsItRQkfzRVELqIl+kzZVqScfFJVy5fbh7I3mlWtIxHHLmBQmpC6BRN1TUui7QVrk1qlPUuqo05cQkQuoEUrol+kaKXl8ybHlE94leX8veCakT+jbQCaTAt/TSvx7qbNFmIdVC3ZwECJwWEFIHVD39dOup1gP2bJeZZKNsNpCQekPf4wbvseY3LZjukv69tlxIvZp8nYmwWb4KufFXz7XfWO7uI7069Fr3biMeXhBSDwE9HlPABz1mX+5UJaQ21EbY4COsYaM105zSv3+tFlL/LL7ejbQ5RlrLV3NO/jXKul/WcXL9o90mpEbr6OTr8cEebwMIqfF6akUEhhIQUkO102IIjCcgpPZ66jwBAiEEhFSINpQrwr/RlLOtMbL+fXwIqdVOsyFWGN4SCCIgpII0QhnRBdTXSkBItZI3b3YBvwlnJw0xoJAK0QZFECCwJyCk9mScJ0AghEDQkAphowgCBAIICKkATVACAQL7AkJq38aVzgR+fX51VrJyTwgIqRNIbmkuoICJBYTUqvmfP4h/rb71lgCBAAJCKkATlECAwL6AkNq3GeKK3w6HaOPUi9gKqalBLJ5AJAE/ZPwfjCPtR7UQILAh4DepDRSn+hXwm0e/vdurXEj9kBlpk+dayw+i8N+Osu5R1vF0wwipDcERNscIa9hozTSn9O9fq4XUPwvvCBAIKCCkAjZFSQRCC1QuTkjtgPf863bPte+04/Lpng16rv1yo048IKTeIPW4WXqs+U0LHl3q0aLHmh816cTDQuoAyaY5AAp+Wf+CN+hEeULqBFLTWy5M7gN5ASvgrfq33RQhte3y7WwPm6eHGr+hVvymB5seaqzYsm9TCalvHPvfRN5ELWtL/4WWK8e+cNkrLY2OVha5tqPaa1wXUheUI26mFjWtQ+kC39etT579GuDBX8kqHQ+GyP7o9XqylxB+QCF1sUWRNlWLWlLIXCTbvT3nWLuTbFxo4bZRxkeUOrZqi3ROSN3oRtpc6bjxaJZH0tzpyDLYhUFKhEqJMc8sqYXfUleaOx3L917fCwip9z5vr7bYaC3mTAitwiTNXepoYdlizlJ+tcYVUm+ljy+mTbccx3ffu2MZP73eG+HZUyMG1CKSTJdjOZf7dRk/veYee4bxhFTGLqdNuD7uDr0eI72/O04vz0UJwWS9Pu76rcdI7++O47nfAkLqt0ORv+9s0DvPFCm+8qBRgmq97Du9uPPMek7vXwWE1KtJ1jNp0145sk6eYbCI4ZFhWaeH+NG7w29PD+zG0wJC6jSVGwkQaCEgpFqodzJn7d+ias/XSRumL1NITb8FtgEExraLs/UFIodUfQ0zEiAQTkBIhWuJgggQWAsIqbWG980F/M/M5i0IV4CQCteS9gW1Doq9+dvLqKCFgJBqoR54TgERuDmTliakJm28ZRPoRUBI9dKpyer0G91kDX+z3N2QevOMS4MKRAuGaPUM2vbwyxJS4VukQAJzCwipuftv9QTCCwip8C0KUqAyCDQSEFKN4KNNG/Xff6LWFa1/I9cjpEbu7sm1CYKTUG5rIiCkmrCblEDvAvXqF1L1rM10U8BvejfhBnlMSA3SyLvL6CUAeqnzbh88ty8gpPZtXCFAIICAkArQhOMS3EFgXgEhNW/vrZxAFwJCqos2lSnSv/OUcTVqXgEhldezm9F6DKgeay60IaYaVkhN1W6LJdCfgJDqr2ePK/YbyWNCA1QUEFIVsSNMJaAidEENVwSE1LGWOwIJCNlAzahUipCqBG2afAKCKp9lDyMJqR66pEYCEwtkCSk/2SbeQRMu3ZKvCzzJiCwhlUp+UkR63lFeQI/KG5vhVeDpvssWUq+lOUOgnMDTjV+uMiPnFhBSuUWDjjfih3rENQXdPk3LCh9STXUGmdyHeZBGTroMITVp4y2bQC8CWUPKT+xe2j5OnfZc7F7m6E/WkEpcqah0pPcOAtkFDNiFQMqAdOQoNntILUXlKnAZz+s9gRn6MMMa73W/zVO5+1EspBJP7mLTmA4CWwL22pZK/XMl+lA0pBJRiaLTuI73Ask9He/vGuvqbOuN1r1S/u9DKpNCqeIzlTfcMDN7z7z2lhu5pHuVkEp4JReRxnf8FuD88cHgo+pXae9qIVVVzWTTC5T+4EwPXBGgakiljbMcFdc4xVR1XPuiTCZ9VdxPtcl2OUpXXTWk1otZFri8rq95fyywuC2vx0/Mecfis7zOqfB81Yvf8vp8xPMjNAupnyWmxf885/ttAVbbLmfOsjuj9P2e1mZhQiqxJAzHsUCyctwXOBZ2x1rgjXSVS6FCqsqKTUKAQFcCQqqrdimWwHwCQmq+nlsxga4EhFQ/7VIpgSkFhNSUbbdoAv0ICKl+eqVSAlMKCKkp227RIwjMsgYhNUunrZNApwJCqtPGKZvALAJCapZOWyeBTgWE1MnGuY0AgTYCQqqNu1kJEDgpIKROQrmNAIE2AkKqjbtZexdQfzUBIVWN2kQECNwREFJ31DxDgEA1ASFVjdpEBAjcEegjpO6szDMECAwhIKSGaKNFEBhXQEiN21srIzCEgJAaoo2zLcJ6ZxIQUjN121oJdCggpDpsmpIJzCQgpGbqtrUS6FDgREh1uColEyAwjICQGqaVFkJgTAEhNWZfrYrAMAJCaphWVluIiQhUFRBSVblNRoDAVQEhdVXM/QQIVBX4PwAAAP//yrXLOQAAAAZJREFUAwAA+doKl3XnugAAAABJRU5ErkJggg==';
  
  const THREE = _ThreeJS_.THREE;
  const three = _ThreeJS_.three;
  const xr = three.renderer.xr;
  const scene = _ThreeJS_.scene;
  let camera = _ThreeJS_.camera;
  let assets = _ThreeJS_.assets;

  let currentSession, xrInputSources;

  let controllers;
  const { XRControllerModelFactory } = await import("https://esm.sh/three@0.182.0/addons/webxr/XRControllerModelFactory.js");
  const controllerModelFactory = new XRControllerModelFactory();

  const { OculusHandModel } = await import("https://esm.sh/three@0.182.0/addons/webxr/OculusHandModel.js");
  const { OculusHandPointerModel } = await import("https://esm.sh/three@0.182.0/addons/webxr/OculusHandPointerModel.js");

  async function init() {
    //Render
    xr.enabled = true;
    _ThreeJS_.stolenRender = true;
    three.renderer.setAnimationLoop( function () {

      //manual rendering/clearing wont work! stopping the project wont affect. No postprocessing either.
      three.renderer.render( scene, camera );

    } );

    //Events
    addEventListener("ThreeJS-Reset", ()=>{
      camera = _ThreeJS_.camera;

      addControls();
    });
    addEventListener("ThreeJS-cameraChange", ()=>{
      camera = _ThreeJS_.camera;
    });
    
    addControls();
    function addControls() {
      // controllers
      controllers = [xr.getController( 0 ), xr.getController( 1 )];
      scene.add( controllers[0] );
      scene.add( controllers[1] );
      
      function addGrip(h) {
        const controllerGrip = xr.getControllerGrip( h );
        controllerGrip.add( controllerModelFactory.createControllerModel( controllerGrip ) );
        scene.add( controllerGrip );
      }
      addGrip(0); addGrip(1);
    }

    //
    Object.defineProperties(_ThreeJS_, {
      xr: { get: () => xr, enumerable: true,},
      xrSession: { get: () => currentSession, enumerable: true, },
    });

  }

  Promise.resolve(init())
    .then(() => {

      class ThreeJSAddon {
        getInfo() {
          return {
            id: extensionID,
            name: "VR",
            color1: "#38685c",
            color2: "#30323D",
            color3: "#606060",
            menuIconURI: extensionIcon,
            blockIconURI: extensionIcon,
            docsURI: "https://github.com/Brackets-Coder/ThreeJS-Extension",
            blocks: [
              {
                opcode: "vrComp",
                blockType: "Boolean",
                text: "[MODE] compatible?",
                arguments: {
                  MODE: {type: "string", menu: "mode"},
                }
              },
              "---",
              {
                opcode: "vrToggle",
                blockType: "command",
                text: "request [MODE] session [STATE]",
                arguments: {
                  MODE: {type: "string", menu: "mode"},
                  STATE: {type: "string", menu: "boolean"},
                }
              },
              {
                opcode: "vrState",
                blockType: "Boolean",
                text: "active session",
              },
              "---",
              {
                opcode: "hands",
                blockType: "command",
                text: "add [HAND] Hand Model to scene",
                arguments: {
                  HAND: {type: "string", menu: "hands"},
                }
              },
              {
                opcode: "handsEvent",
                blockType: "event",
                text: "when [HAND] Hand is pinched",
                isEdgeActivated: false,
                //shouldRestartExistingThreads: true,
                arguments: {
                  HAND: {type: "string", menu: "hands"},
                }
              },
              "---",
              /*
              {
                opcode: "controllerEvent",
                blockType: "event",
                text: "when [HAND] Controller action [BUTTON]",
                isEdgeActivated: false,
                //shouldRestartExistingThreads: true,
                arguments: {
                  HAND: {type: "string", menu: "hands"},
                  BUTTON: {type: "string", menu: "buttons"},
                }
              },*/
              
              {
                opcode: "controller",
                blockType: "reporter",
                text: "get [HAND] Controller button [BUTTON] [ACTION]",
                isEdgeActivated: false,
                //shouldRestartExistingThreads: true,
                arguments: {
                  HAND: {type: "string", menu: "hands"},
                  BUTTON: {type: "string", menu: "buttons" },
                  ACTION: {type: "string", menu: "buttonActions" },
                }
              },
            ],
            menus: {
              mode: {items: [
                { text: Scratch.translate("AR"), value: "immersive-ar" },
                { text: Scratch.translate("VR"), value: "immersive-vr" },
              ]},
              boolean: { acceptReporters: true, items: [
                { text: Scratch.translate("on"), value: "true" },
                { text: Scratch.translate("off"), value: "false" },
              ]},
              hands: { items: [
                { text: Scratch.translate("Right"), value: "0" },
                { text: Scratch.translate("Left"), value: "1" },
              ]},
              buttons: { items: [
                { text: Scratch.translate("Trigger"), value: "0" },
                { text: Scratch.translate("Grip"), value: "1" },
                { text: Scratch.translate("Touchpad"), value: "2" },
                { text: Scratch.translate("Thumbstick"), value: "3" },
                { text: Scratch.translate("A / X"), value: "4" },
                { text: Scratch.translate("B / Y"), value: "5" },
                { text: Scratch.translate("Surface / Thumb Rest"), value: "6" },
              ]},
              buttonActions: { items: [
                { text: Scratch.translate("Pressed"), value: "pressed" },
                { text: Scratch.translate("Touched"), value: "touched" },
                { text: Scratch.translate("Value"), value: "value" },
              ]},
            },
          };
        }

        vrComp(args) {
          return navigator.xr.isSessionSupported(args.MODE);
        }
        
        async vrToggle(args) {

          xr.enabled = JSON.parse(args.STATE);

          if (xr.enabled) {

            navigator.xr.requestSession( args.MODE, {
              requiredFeatures: [  ],
              optionalFeatures: [
                'hand-tracking',
                'local-floor',
                'bounded-floor',
                'layers',
              ],
            } )
						.then( onSessionStarted );

          } else {

            currentSession.end();

          }

          async function onSessionStarted( session ) {
            session.addEventListener('inputsourceschange', onInputSourcesChange);
            function onInputSourcesChange(event) {
              xrInputSources = event.session.inputSources;
            }

            session.addEventListener( 'end', onSessionEnded );
            await xr.setSession( session );
            currentSession = session;
            xrInputSources = session.inputSources;

            console.log("Started Three JS XR Session!", session, xrInputSources);
          }

          function onSessionEnded() {
            currentSession.removeEventListener( 'end', onSessionEnded );
            currentSession = null;
            console.log("Ended Three JS XR Session!");
          }
        }

        vrState(args) {
          return xr.isPresenting;
        }

        hands(args) {
          const hand = xr.getHand( args.HAND );
          hand.add( new OculusHandModel( hand ) );
          const handPointer = new OculusHandPointerModel( hand, controllers[args.HAND] );
          hand.add( handPointer );

          scene.add( hand );

          hand.addEventListener( 'pinchend', function () {

            runtime.startHats(`${extensionID}_handsEvent`, {HAND: args.HAND} );

          } );
        }

        controller(args) {
          const sources = xr.getSession().inputSources;
          const hand = args.HAND == 1 ? "left" : "right";
          console.log(sources, hand);
          const input = sources.find(s => s.handedness === hand);
          // Uncaught TypeError: Cannot read properties of undefined (reading 'gamepad')
          return input?.gamepad?.buttons[args.BUTTON][args.ACTION];
        }

      }

      Scratch.extensions.register(new ThreeJSAddon());

    })

    .catch((err) => {
      console.error("Extension failed to load: ", err.message);
    });
    
})(Scratch);
