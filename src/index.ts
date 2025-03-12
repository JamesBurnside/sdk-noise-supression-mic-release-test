import { Call, CallClient, LocalVideoStream, VideoStreamRenderer, VideoStreamRendererView } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";

const groupId = '9d5ec556-3677-4c5b-a648-cfeb05f90658';

// Mobile its a pain to get the token, so we have a default one that is auto applied
const defaultMobileToken = '<REPLACE_ME>';

let chosenCameraCounter = 0;

async function main() {
  console.log('Starting app');

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  // await for input of #userTokenInput to have value
  const token = (isAndroid || isIos) ? defaultMobileToken : await new Promise<string>((resolve) => {
    const userTokenInput = document.getElementById('userTokenInput') as HTMLInputElement;
    userTokenInput.addEventListener('input', () => {
      userTokenInput.disabled = true;
      resolve(userTokenInput.value);
    });
  });

  // REQUEST PERMISSIONS
  await navigator.permissions.query({ name: 'camera' as PermissionName });
  await navigator.permissions.query({ name: 'microphone' as PermissionName})
  
  // LOAD SDK
  const sdkStatusSpan = document.getElementById('sdkStatus');
  sdkStatusSpan.innerText = 'SDK Loading';
  const callClient = new CallClient();
  const tokenCredential = new AzureCommunicationTokenCredential(token);
  const callAgent = await callClient.createCallAgent(tokenCredential, { displayName: `ACS User ${Math.floor(Math.random() * 100)}` });
  const deviceManager = await callClient.getDeviceManager()
  sdkStatusSpan.innerText = 'SDK Loaded';
  const displayNameSpan = document.getElementById('displayName');
  displayNameSpan.innerText = callAgent.displayName;

  // JOIN CALL
  const call = callAgent.join({ groupId }, { audioOptions: { muted: true } });
  const callStatusSpan = document.getElementById('callStatus');
  call.on('stateChanged', () => {
    callStatusSpan.innerText = call.state;
  });
  const callIdSpan = document.getElementById('callId');
  callIdSpan.innerText = call.id;
  call.on('idChanged', () => {
    callIdSpan.innerText = call.id;
  });

  // SETUP REMOTE PARTICIPANTS IN CALL
  const remoteParticipantsDiv = document.getElementById('remoteParticipants');
  call.on('remoteParticipantsUpdated', (e) => {
    console.log('Remote participants updated', e);
    e.added.forEach((participant) => {
      console.log('Remote participant added', participant);
      const participantDiv = document.createElement('div');
      participantDiv.innerText = `Remote Participant: ${participant.displayName}`;
      remoteParticipantsDiv.appendChild(participantDiv);
    });
    e.removed.forEach((participant) => {
      console.log('Remote participant removed', participant);
      const participantDiv = remoteParticipantsDiv.querySelector(`div:contains(${participant.displayName})`);
      remoteParticipantsDiv.removeChild(participantDiv);
    });
  });


  // SETUP MIC BUTTON
  const muteButton = document.getElementById('micButton') as HTMLButtonElement;
  call.on('isMutedChanged', () => {
    muteButton.innerText = call.isMuted ? 'Unmute' : 'Mute';
  });
  muteButton.addEventListener('click', async () => {
    muteButton.disabled = true;
    try {
      call.isMuted ? await call.unmute() : await call.mute();
    } finally {
      muteButton.disabled = false;
    }
  });

  // SETUP CAMERA BUTTON
  const videoButton = document.getElementById('cameraButton') as HTMLButtonElement;
  let videoStarted = false;
  call.on('isLocalVideoStartedChanged', () => {
    videoStarted = call.isLocalVideoStarted;
    videoButton.innerText = call.isLocalVideoStarted ? 'Stop Video' : 'Start Video';
  });
  let localVideoStream: LocalVideoStream;
  videoButton.addEventListener('click', async () => {
    videoButton.disabled = true;
    try {
      if (videoStarted) {
        // STOP LOCAL VIDEO
        await call.stopVideo(localVideoStream);
        localVideoStream = undefined;
      } else {
        // START LOCAL VIDEO
        const cameras = await deviceManager.getCameras();
        const camera = cameras[0]
        localVideoStream = new LocalVideoStream(camera);
        try {
          await call.startVideo(localVideoStream);
        } catch (e) {
          localVideoStream = undefined
          throw e;
        }
      }
    } finally {
      videoButton.disabled = false;
    }
  });

  // SETUP LOCAL FEED DISPLAY
  const chosenCameraLabel = document.getElementById('chosenCameraLabel');
  const localFeedDiv = document.getElementById('localVideo');
  let localFeedView: VideoStreamRendererView;
  call.on('localVideoStreamsUpdated', async (e) => {
    console.log('Local video streams updated', e);
    e.added.forEach(async (stream) => {
      console.log('Adding local video stream');
      chosenCameraLabel.innerText = `${stream.source.name}`;
      const renderer = new VideoStreamRenderer(stream);
      localFeedView = await renderer.createView({ scalingMode: 'Fit' });
      localFeedDiv.appendChild(localFeedView.target);
    });
    e.removed.forEach(() => {
      console.log('Removing local video stream');
      localFeedView?.dispose();
    });
  });

  // SETUP REMOTE FEED DISPLAY - CURRENTLY ONLY WORKS WITH ONE REMOTE PERSON IN CALL
  const remoteFeedDiv = document.getElementById('remoteVideo');
  let remoteFeedView: VideoStreamRendererView;
  call.remoteParticipants.forEach(async (participant) => {
    console.log('Subscribing to remote participant video streams', participant);
    participant.on('videoStreamsUpdated', async (e) => {
      console.log('Remote participant video streams updated', e);
      e.added.forEach(async (stream) => {
        console.log('Adding remote video stream');
        const renderer = new VideoStreamRenderer(stream);
        remoteFeedView = await renderer.createView({ scalingMode: 'Fit' });
        remoteFeedDiv.appendChild(remoteFeedView.target);
      });
      e.removed.forEach(() => {
        console.log('Removing remote video stream');
        remoteFeedView?.dispose();
        remoteFeedDiv.removeChild(remoteFeedView.target);
      });
    });
    // process existing video streams
    console.log('Processing existing video stream for remote participant', participant.displayName);
    participant.videoStreams.forEach(async (stream) => {
      console.log('Adding remote video stream');
      const renderer = new VideoStreamRenderer(stream);
      remoteFeedView = await renderer.createView({ scalingMode: 'Fit' });
      remoteFeedDiv.appendChild(remoteFeedView.target);
    });

  });
  call.on('remoteParticipantsUpdated', async (e) => {
    e.added.forEach(async (participant) => {
      console.log('Subscribing to remote participant video streams', participant);
      participant.on('videoStreamsUpdated', async (e) => {
        console.log('Remote participant video streams updated', e);
        e.added.forEach(async (stream) => {
          console.log('Adding remote video stream');
          const renderer = new VideoStreamRenderer(stream);
          remoteFeedView = await renderer.createView({ scalingMode: 'Fit' });
          remoteFeedDiv.appendChild(remoteFeedView.target);
        });
        e.removed.forEach(() => {
          console.log('Removing remote video stream');
          remoteFeedView?.dispose();
          remoteFeedDiv.removeChild(remoteFeedView.target);
        });
      });
      // process existing video streams
      console.log('Processing existing video stream for remote participant', participant.displayName);
      participant.videoStreams.forEach(async (stream) => {
        console.log('Adding remote video stream');
        const renderer = new VideoStreamRenderer(stream);
        remoteFeedView = await renderer.createView({ scalingMode: 'Fit' });
        remoteFeedDiv.appendChild(remoteFeedView.target);
      });
    });
    e.removed.forEach((participant) => {
      console.log('Remote participant removed', participant);
    });
  });

  // SETUP SWITCH CAMERA BUTTON
  const switchCameraButton = document.getElementById('switchCameraButton') as HTMLButtonElement;
  switchCameraButton.addEventListener('click', async () => {
    switchCameraButton.disabled = true;
    try {
      await switchCameraSource(call, localVideoStream, deviceManager, chosenCameraLabel);
      let intervalCounter = 0;
      setInterval(async () => {
        if (intervalCounter > 50) {
          return;
        }

        await switchCameraSource(call, localVideoStream, deviceManager, chosenCameraLabel);
        intervalCounter++;
      }, 1000);
    } finally {
      switchCameraButton.disabled = false;
    }
  });

  // SETUP END CALL BUTTON
  const endCallButton = document.getElementById('endCallButton') as HTMLButtonElement;
  endCallButton.addEventListener('click', async () => {
    endCallButton.disabled = true;
    try {
      await call.hangUp();
    } finally {
      endCallButton.disabled = false;
    }
  });
}

const switchCameraSource = async (call: Call, localVideoStream: LocalVideoStream, deviceManager: any, chosenCameraLabel: HTMLElement) => {
  if (!localVideoStream) {
    console.error('Local video stream not started, cannot switch camera source');
    return;
  }
  const cameras = await deviceManager.getCameras();
  const currentCamera = call.localVideoStreams[0].source;
  const newCamera = cameras[(++chosenCameraCounter) % cameras.length]; // Cycle through cameras
  chosenCameraLabel.innerText = `${newCamera.name}`;
  console.log('Switching camera source', currentCamera, newCamera);
  await localVideoStream.switchSource(newCamera);
};

main();