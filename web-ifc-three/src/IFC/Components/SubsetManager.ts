import { BufferGeometry, Material, Mesh, Object3D } from 'three';
import {
    IfcState,
    GeometriesByMaterials,
    IdGeometries,
    merge,
    SelectedItems,
    DEFAULT,
    HighlightConfigOfModel
} from '../BaseDefinitions';
import { BvhManager } from './BvhManager';

/**
 * Contains the logic to get, create and delete geometric subsets of an IFC model. For example,
 * this can extract all the items in a specific IfcBuildingStorey and create a new Mesh.
 */
export class SubsetManager {
    private state: IfcState;
    private BVH: BvhManager;
    private readonly selected: SelectedItems = {};

    constructor(state: IfcState, BVH: BvhManager) {
        this.state = state;
        this.BVH = BVH;
    }

    getSubset(modelID: number, material?: Material) {
        const currentMat = this.matIDNoConfig(modelID, material);
        if (!this.selected[currentMat]) return null;
        return this.selected[currentMat].mesh;
    }

    removeSubset(modelID: number, parent?: Object3D, material?: Material) {
        const currentMat = this.matIDNoConfig(modelID, material);
        if (!this.selected[currentMat]) return;
        if (parent) parent.remove(this.selected[currentMat].mesh);
        delete this.selected[currentMat];
    }

    createSubset(config: HighlightConfigOfModel) {
        if (!this.isConfigValid(config)) return;
        if (this.isPreviousSelection(config)) return;
        if (this.isEasySelection(config)) return this.addToPreviousSelection(config);
        this.updatePreviousSelection(config.scene, config);
        return this.createSelectionInScene(config);
    }

    private createSelectionInScene(config: HighlightConfigOfModel) {
        const filtered = this.filter(config);
        const { geomsByMaterial, materials } = this.getGeomAndMat(filtered);
        const isDefMaterial = this.isDefaultMat(config);
        const geometry = this.getMergedGeometry(geomsByMaterial, isDefMaterial);
        const mats = isDefMaterial ? materials : config.material;
        this.BVH.applyThreeMeshBVH(geometry);
        //@ts-ignore
        const mesh = new Mesh(geometry, mats);
        this.selected[this.matID(config)].mesh = mesh;
        //@ts-ignore
        mesh.modelID = config.modelID;
        config.scene.add(mesh);
        return mesh;
    }

    private getMergedGeometry(geomsByMaterial: BufferGeometry[], hasDefaultMaterial: boolean) {
        return geomsByMaterial.length > 0
            ? merge(geomsByMaterial, hasDefaultMaterial)
            : new BufferGeometry();
    }

    private isConfigValid(config: HighlightConfigOfModel) {
        return (
            this.isValid(config.scene) &&
            this.isValid(config.modelID) &&
            this.isValid(config.ids) &&
            this.isValid(config.removePrevious)
        );
    }

    private isValid(item: any) {
        return item != undefined && item != null;
    }

    private getGeomAndMat(filtered: GeometriesByMaterials) {
        const geomsByMaterial: BufferGeometry[] = [];
        const materials: Material[] = [];
        for (let matID in filtered) {
            const geoms = Object.values(filtered[matID].geometries);
            if (!geoms.length) continue;
            materials.push(filtered[matID].material);
            if (geoms.length > 1) geomsByMaterial.push(merge(geoms));
            else geomsByMaterial.push(...geoms);
        }
        return { geomsByMaterial, materials };
    }

    private updatePreviousSelection(parent: Object3D, config: HighlightConfigOfModel) {
        const previous = this.selected[this.matID(config)];
        if (!previous) return this.newSelectionGroup(config);
        parent.remove(previous.mesh);
        config.removePrevious
            ? (previous.ids = new Set(config.ids))
            : config.ids.forEach((id) => previous.ids.add(id));
    }

    private newSelectionGroup(config: HighlightConfigOfModel) {
        this.selected[this.matID(config)] = {
            ids: new Set(config.ids),
            mesh: {} as Mesh
        };
    }

    private isPreviousSelection(config: HighlightConfigOfModel) {
        if (!this.selected[this.matID(config)]) return false;
        if (config.removePrevious) return false;
        if (this.containsIds(config)) return true;
        const previousIds = this.selected[this.matID(config)].ids;
        return JSON.stringify(config.ids) === JSON.stringify(previousIds);
    }

    private containsIds(config: HighlightConfigOfModel) {
        const newIds = config.ids;
        const previous = Array.from(this.selected[this.matID(config)].ids);
        // prettier-ignore
        //@ts-ignore
        return newIds.every((i => v => (i = previous.indexOf(v, i) + 1))(0));
    }

    private addToPreviousSelection(config: HighlightConfigOfModel) {
        const previous = this.selected[this.matID(config)];
        const filtered = this.filter(config);
        // @ts-ignore
        // prettier-ignore
        const geometries = Object.values(filtered).map((i) => Object.values(i.geometries)).flat();
        const previousGeom = previous.mesh.geometry;
        previous.mesh.geometry = merge([previousGeom, ...geometries]);
        config.ids.forEach((id) => previous.ids.add(id));
    }

    private filter(config: HighlightConfigOfModel) {
        const ids = this.selected[this.matID(config)].ids;
        const items = this.state.models[config.modelID].items;
        const filtered: GeometriesByMaterials = {};
        for (let matID in items) {
            filtered[matID] = {
                material: items[matID].material,
                geometries: this.filterGeometries(ids, items[matID].geometries)
            };
        }
        return filtered;
    }

    private filterGeometries(selectedIDs: Set<number>, geometries: IdGeometries) {
        const ids = Array.from(selectedIDs);
        return Object.keys(geometries)
            .filter((key) => ids.includes(parseInt(key, 10)))
            .reduce((obj, key) => {
                //@ts-ignore
                return { ...obj, [key]: geometries[key] };
            }, {});
    }

    private isEasySelection(config: HighlightConfigOfModel) {
        const matID = this.matID(config);
        if (!config.removePrevious && !this.isDefaultMat(config) && this.selected[matID]) return true;
    }

    private isDefaultMat(config: HighlightConfigOfModel) {
        return this.matIDNoConfig(config.modelID) === this.matID(config);
    }

    private matID(config: HighlightConfigOfModel) {
        let name;
        if (!config.material) name = DEFAULT;
        else name = config.material.uuid || DEFAULT;
        return name.concat(' - ').concat(config.modelID.toString());
    }

    private matIDNoConfig(modelID: number, material?: Material) {
        let name = DEFAULT;
        if (material) name = material.uuid;
        return name.concat(' - ').concat(modelID.toString());
    }
}
