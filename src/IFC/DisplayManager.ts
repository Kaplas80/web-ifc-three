import {
    Display,
    IfcState,
    MapIDFaceIndex,
    TransparentMesh,
    VertexProps,
    IfcMesh
} from './BaseDefinitions';
import { BufferAttribute, BufferGeometry, Material, Mesh, Scene } from 'three';
import { TransparentShader } from './Shaders';

export class DisplayManager {
    private state: IfcState;

    constructor(state: IfcState) {
        this.state = state;
    }

    setItemsDisplay(modelID: number, ids: number[], state: Display, scene: Scene) {
        const mesh = this.state.models[modelID].mesh;
        const geometry = mesh.geometry;
        this.setupVisibility(geometry);

        const current = mesh.modelID;
        const faceIndicesArray = ids.map((id) => this.state.models[current].faces[id]);
        const faceIndices = ([] as number[]).concat(...faceIndicesArray);
        faceIndices.forEach((faceIndex) => this.setFaceDisplay(geometry, faceIndex, state));

        geometry.attributes[VertexProps.r].needsUpdate = true;
        geometry.attributes[VertexProps.g].needsUpdate = true;
        geometry.attributes[VertexProps.b].needsUpdate = true;
        geometry.attributes[VertexProps.a].needsUpdate = true;
        geometry.attributes[VertexProps.h].needsUpdate = true;

        if (state.a != 1) this.setupTransparency(mesh, scene);
    }

    setupVisibility(geometry: BufferGeometry) {
        if (!geometry.attributes[VertexProps.r]) {
            const zeros = new Float32Array(geometry.getAttribute('position').count);
            geometry.setAttribute(VertexProps.r, new BufferAttribute(zeros.slice(), 1));
            geometry.setAttribute(VertexProps.g, new BufferAttribute(zeros.slice(), 1));
            geometry.setAttribute(VertexProps.b, new BufferAttribute(zeros.slice(), 1));
            geometry.setAttribute(VertexProps.a, new BufferAttribute(zeros.slice().fill(1), 1));
            geometry.setAttribute(VertexProps.h, new BufferAttribute(zeros, 1));
        }
    }

    private setFaceDisplay(geometry: BufferGeometry, index: number, state: Display) {
        if (!geometry.index) return;
        const geoIndex = geometry.index.array;
        this.setFaceAttr(geometry, VertexProps.r, state.r, index, geoIndex);
        this.setFaceAttr(geometry, VertexProps.g, state.g, index, geoIndex);
        this.setFaceAttr(geometry, VertexProps.b, state.b, index, geoIndex);
        this.setFaceAttr(geometry, VertexProps.a, state.a, index, geoIndex);
        this.setFaceAttr(geometry, VertexProps.h, state.h, index, geoIndex);
    }

    private setFaceAttr(
        geom: BufferGeometry,
        attr: string,
        state: number,
        index: number,
        geoIndex: ArrayLike<number>
    ) {
        geom.attributes[attr].setX(geoIndex[3 * index], state);
        geom.attributes[attr].setX(geoIndex[3 * index + 1], state);
        geom.attributes[attr].setX(geoIndex[3 * index + 2], state);
    }

    private setupTransparency(ifcMesh: IfcMesh, scene: Scene) {
        const mesh = ifcMesh as TransparentMesh;
        if (mesh.transparentMesh) return;
        const transMesh = mesh.clone();

        const transparentMaterials: Material[] = [];

        if (Array.isArray(transMesh.material)) {
            transMesh.material.forEach((mat) => {
                transparentMaterials.push(this.newTransparent(mat));
            });
            transMesh.material = transparentMaterials;
        } else {
            transMesh.material = this.newTransparent(transMesh.material);
        }

        scene.add(transMesh);
        mesh.transparentMesh = transMesh;
    }

    private newTransparent(mat: Material) {
        const newMat = mat.clone();
        newMat.transparent = true;
        // newMat.depthTest = false;
        newMat.onBeforeCompile = TransparentShader;
        return newMat;
    }
}
