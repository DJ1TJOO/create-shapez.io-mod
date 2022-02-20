import { formatItemsPerSecond } from "shapez/core/utils";
import { Vector, enumDirection } from "shapez/core/vector";
import { ItemAcceptorComponent } from "shapez/game/components/item_acceptor";
import { ItemEjectorComponent } from "shapez/game/components/item_ejector";
import { ItemProcessorComponent } from "shapez/game/components/item_processor";
import { enumItemProcessorTypes } from "shapez/game/components/item_processor";
import { Entity } from "shapez/game/entity";
import { MOD_ITEM_PROCESSOR_SPEEDS } from "shapez/game/hub_goals";
import { ShapeItem } from "shapez/game/items/shape_item";
import { defaultBuildingVariant } from "shapez/game/meta_building";
import { TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT, TOP_LEFT, ShapeDefinition } from "shapez/game/shape_definition";
import { ItemProcessorSystem, MOD_ITEM_PROCESSOR_HANDLERS, ProcessorImplementationPayload } from "shapez/game/systems/item_processor";
import { Mod } from "shapez/mods/mod";
import { ModInterface } from "shapez/mods/mod_interface";
import { ModMetaBuilding } from "shapez/mods/mod_meta_building";
import { GameRoot } from "shapez/savegame/savegame";
import { T } from "shapez/translations";


declare module "shapez/game/components/item_processor" {
	export interface enumItemProcessorTypes {
		flipper: 'flipper';
	}
}


import flipper_png from '../res/sprites/1.png';



// Create the building
class MetaModFlipperBuilding extends ModMetaBuilding {
	constructor() {
		super("modFlipperBuilding");
	}

	static getAllVariantCombinations() {
		return [
			{
				name: "Flipper",
				description: "Flipps/Mirrors shapez from top to bottom",
				variant: defaultBuildingVariant,

				regularImageBase64: flipper_png,
				blueprintImageBase64: flipper_png,
				tutorialImageBase64: flipper_png,
			},
		];
	}

	getSilhouetteColor() {
		return "red";
	}

	getAdditionalStatistics(root: GameRoot): [string, string][] {
		const speed = root.hubGoals.getProcessorBaseSpeed(enumItemProcessorTypes.flipper);
		return [[T.ingame.buildingPlacement.infoTexts.speed, formatItemsPerSecond(speed)]];
	}

	getIsUnlocked(root: GameRoot) {
		return true;
	}

	setupEntityComponents(entity: Entity) {
		// Accept shapes from the bottom
		entity.addComponent(
			new ItemAcceptorComponent({
				slots: [
					{
						pos: new Vector(0, 0),
						direction: enumDirection.bottom,
						filter: "shape",
					},
				],
			})
		);

		// Process those shapes with tye processor type "flipper" (which we added above)
		entity.addComponent(
			new ItemProcessorComponent({
				inputsPerCharge: 1,
				processorType: enumItemProcessorTypes.flipper,
			})
		);

		// Eject the result to the top
		entity.addComponent(
			new ItemEjectorComponent({
				slots: [{ pos: new Vector(0, 0), direction: enumDirection.top }],
			})
		);
	}

	static processPayload(this: ItemProcessorSystem, payload: ProcessorImplementationPayload) {
		// Declare a handler for the processor so we define the "flip" operation
		let item = payload.items.get(0) as ShapeItem;
		const shapeDefinition = item.definition;

		// Flip bottom with top on a new, cloned item (NEVER modify the incoming item!)
		const newLayers = shapeDefinition.getClonedLayers();
		newLayers.forEach(layer => {
			const tr = layer[TOP_RIGHT];
			const br = layer[BOTTOM_RIGHT];
			const bl = layer[BOTTOM_LEFT];
			const tl = layer[TOP_LEFT];

			layer[BOTTOM_LEFT] = tl;
			layer[BOTTOM_RIGHT] = tr;

			layer[TOP_LEFT] = bl;
			layer[TOP_RIGHT] = br;
		});

		const newDefinition = new ShapeDefinition({ layers: newLayers });
		payload.outItems.push({
			item: this.root.shapeDefinitionMgr.getShapeItemFromDefinition(newDefinition),
		});
	};


	static register(modInterface: ModInterface) {
		// Declare a new type of item processor
		enumItemProcessorTypes.flipper = "flipper";
		// For now, flipper always has the same speed
		MOD_ITEM_PROCESSOR_SPEEDS.flipper = () => 10;
		// Declare a handler for the processor so we define the "flip" operation
		MOD_ITEM_PROCESSOR_HANDLERS.flipper = this.processPayload;

		// Register the new building
		modInterface.registerNewBuilding({
			metaClass: MetaModFlipperBuilding,
			buildingIconBase64: flipper_png,
		});

		// Add it to the regular toolbar
		modInterface.addNewBuildingToToolbar({
			toolbar: "regular",
			location: "primary",
			metaClass: MetaModFlipperBuilding,
		});
	}
}

class FlipperMod extends Mod {
	init() {
		MetaModFlipperBuilding.register(this.modInterface);
	}
}