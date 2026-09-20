"use client";

import * as React from "react";
import { useThree } from "@react-three/fiber";
import { Spherical, Vector3, type Camera } from "three";
import {
  clampDistance,
  poseForView,
  sphericalToPosition,
  stepDistance,
  type CameraView,
} from "./cameraViews";
import { defaultCameraFraming, type CameraFraming } from "./cameraFraming";

interface OrbitLike {
  object: Camera;
  target: Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
}

export interface CameraCommand {
  id: number;
  type: "view" | "zoom" | "reset";
  view?: CameraView;
  direction?: 1 | -1;
}

interface CameraRigProps {
  command: CameraCommand | null;
  framing?: CameraFraming;
}

function applyPose(
  camera: Camera,
  controls: OrbitLike | null,
  position: [number, number, number],
  target: [number, number, number],
  minDistance: number,
  maxDistance: number,
): void {
  camera.position.set(position[0], position[1], position[2]);
  const look = new Vector3(target[0], target[1], target[2]);
  camera.lookAt(look);
  if (controls) {
    controls.target.copy(look);
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.update();
  }
}

/**
 * Executa comandos de camera sobre o OrbitControls padrao.
 * O reset e o enquadramento inicial usam `framing` (bounding box), nao uma posicao fixa.
 */
export function CameraRig({ command, framing }: CameraRigProps) {
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  const camera = useThree((state) => state.camera);
  const lastId = React.useRef<number>(-1);
  const framedKey = React.useRef<string>("");
  const followFraming = React.useRef(true);
  const active = framing ?? defaultCameraFraming();

  React.useEffect(() => {
    if (!followFraming.current) return;
    const key = `${active.target.join(",")}:${active.radius.toFixed(3)}`;
    if (framedKey.current === key) return;
    framedKey.current = key;
    applyPose(camera, controls, active.defaultPosition, active.target, active.minDistance, active.maxDistance);
  }, [active, camera, controls]);

  React.useEffect(() => {
    if (!command || command.id === lastId.current) return;
    lastId.current = command.id;

    const targetVec = controls?.target ?? new Vector3(active.target[0], active.target[1], active.target[2]);
    const offset = new Vector3().copy(camera.position).sub(targetVec);
    const spherical = new Spherical().setFromVector3(offset);

    if (command.type === "reset") {
      followFraming.current = true;
      framedKey.current = `${active.target.join(",")}:${active.radius.toFixed(3)}`;
      applyPose(camera, controls, active.defaultPosition, active.target, active.minDistance, active.maxDistance);
      return;
    }
    followFraming.current = false;
    if (command.type === "view" && command.view) {
      const pose = poseForView(command.view, {
        radius: clampDistance(spherical.radius, active.minDistance, active.maxDistance),
        phi: spherical.phi,
        theta: spherical.theta,
      });
      const position = sphericalToPosition(pose, active.target);
      applyPose(camera, controls, position, active.target, active.minDistance, active.maxDistance);
      return;
    }
    if (command.type === "zoom" && command.direction) {
      spherical.radius = stepDistance(spherical.radius, command.direction, active.minDistance, active.maxDistance);
      camera.position.copy(targetVec).add(new Vector3().setFromSpherical(spherical));
      camera.lookAt(targetVec);
      controls?.update();
    }
  }, [command, camera, controls, active]);

  return null;
}
