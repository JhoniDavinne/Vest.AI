"use client";

import * as React from "react";
import { useThree } from "@react-three/fiber";
import { Spherical, Vector3, type Camera } from "three";
import {
  clampDistance,
  defaultSphericalPose,
  poseForView,
  sphericalToPosition,
  stepDistance,
  type CameraView,
} from "./cameraViews";

/** Superficie minima do OrbitControls usada aqui (evita importar three-stdlib). */
interface OrbitLike {
  object: Camera;
  target: Vector3;
  update: () => void;
}

export interface CameraCommand {
  /** Contador monotonico; cada incremento executa o comando uma vez. */
  id: number;
  type: "view" | "zoom" | "reset";
  view?: CameraView;
  direction?: 1 | -1;
}

interface CameraRigProps {
  command: CameraCommand | null;
}

/**
 * Executa comandos de camera (frente/lateral/costas, zoom, reset) sobre o
 * OrbitControls padrao da cena (`makeDefault`). Nao cria um segundo Canvas
 * nem substitui a interacao por arraste/scroll.
 */
export function CameraRig({ command }: CameraRigProps) {
  const controls = useThree((state) => state.controls) as unknown as OrbitLike | null;
  const camera = useThree((state) => state.camera);
  const lastId = React.useRef<number>(-1);

  React.useEffect(() => {
    if (!command || command.id === lastId.current) return;
    lastId.current = command.id;

    const target = controls?.target ?? new Vector3(0, 0.62, 0);
    const offset = new Vector3().copy(camera.position).sub(target);
    const spherical = new Spherical().setFromVector3(offset);

    if (command.type === "reset") {
      const pose = defaultSphericalPose();
      const [x, y, z] = sphericalToPosition(pose);
      camera.position.set(x, y, z);
    } else if (command.type === "view" && command.view) {
      const pose = poseForView(command.view, {
        radius: clampDistance(spherical.radius),
        phi: spherical.phi,
        theta: spherical.theta,
      });
      const [x, y, z] = sphericalToPosition(pose);
      camera.position.set(x, y, z);
    } else if (command.type === "zoom" && command.direction) {
      spherical.radius = stepDistance(spherical.radius, command.direction);
      camera.position.copy(target).add(new Vector3().setFromSpherical(spherical));
    }

    camera.lookAt(target);
    controls?.update();
  }, [command, camera, controls]);

  return null;
}
