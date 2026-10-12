/**
 * Allergen taxonomy data
 * 
 * Tree structure covering US Big 9, EU 14, and common allergens.
 * Peanut and tree nuts are thoroughly mapped per spec requirements.
 */

export interface AllergenTaxonomyNode {
  code: string;
  name: string;
  description?: string;
  children?: AllergenTaxonomyNode[];
}

export const allergenTaxonomy: AllergenTaxonomyNode[] = [
  {
    code: "peanut",
    name: "Peanut",
    description: "Peanuts (Arachis hypogaea), a legume allergen",
  },
  {
    code: "tree_nut",
    name: "Tree Nut",
    description: "Tree nuts (excluding peanuts and coconut by default)",
    children: [
      {
        code: "almond",
        name: "Almond",
        description: "Prunus dulcis",
      },
      {
        code: "cashew",
        name: "Cashew",
        description: "Anacardium occidentale",
      },
      {
        code: "pecan",
        name: "Pecan",
        description: "Carya illinoinensis",
      },
      {
        code: "walnut",
        name: "Walnut",
        description: "Juglans spp.",
        children: [
          {
            code: "black_walnut",
            name: "Black Walnut",
            description: "Juglans nigra",
          },
          {
            code: "english_walnut",
            name: "English Walnut",
            description: "Juglans regia",
          },
        ],
      },
      {
        code: "pistachio",
        name: "Pistachio",
        description: "Pistacia vera",
      },
      {
        code: "hazelnut",
        name: "Hazelnut",
        description: "Corylus avellana (also called filbert)",
      },
      {
        code: "macadamia",
        name: "Macadamia",
        description: "Macadamia integrifolia and M. tetraphylla",
      },
      {
        code: "brazil_nut",
        name: "Brazil Nut",
        description: "Bertholletia excelsa",
      },
      {
        code: "pine_nut",
        name: "Pine Nut",
        description: "Pinus spp. (also called pignoli, pinon)",
      },
      {
        code: "chestnut",
        name: "Chestnut",
        description: "Castanea spp.",
      },
      {
        code: "beechnut",
        name: "Beechnut",
        description: "Fagus spp.",
      },
      {
        code: "butternut",
        name: "Butternut",
        description: "Juglans cinerea (white walnut)",
      },
      {
        code: "hickory",
        name: "Hickory Nut",
        description: "Carya spp.",
      },
    ],
  },
  {
    code: "coconut",
    name: "Coconut",
    description: "Cocos nucifera. FDA historically classified as tree nut; configurable per person",
  },
  {
    code: "milk",
    name: "Milk",
    description: "Dairy/cow's milk proteins",
  },
  {
    code: "egg",
    name: "Egg",
    description: "Chicken egg proteins",
  },
  {
    code: "fish",
    name: "Fish",
    description: "Finned fish",
  },
  {
    code: "shellfish",
    name: "Shellfish",
    description: "Crustaceans and mollusks",
    children: [
      {
        code: "crustacean",
        name: "Crustacean",
        description: "Shrimp, crab, lobster, etc.",
        children: [
          {
            code: "shrimp",
            name: "Shrimp",
          },
          {
            code: "crab",
            name: "Crab",
          },
          {
            code: "lobster",
            name: "Lobster",
          },
          {
            code: "crayfish",
            name: "Crayfish",
          },
        ],
      },
      {
        code: "mollusk",
        name: "Mollusk",
        description: "Clams, oysters, mussels, scallops, squid, etc.",
        children: [
          {
            code: "clam",
            name: "Clam",
          },
          {
            code: "oyster",
            name: "Oyster",
          },
          {
            code: "mussel",
            name: "Mussel",
          },
          {
            code: "scallop",
            name: "Scallop",
          },
          {
            code: "squid",
            name: "Squid",
          },
          {
            code: "octopus",
            name: "Octopus",
          },
        ],
      },
    ],
  },
  {
    code: "soy",
    name: "Soy",
    description: "Soybean (Glycine max)",
  },
  {
    code: "wheat",
    name: "Wheat",
    description: "Triticum spp.",
  },
  {
    code: "gluten",
    name: "Gluten",
    description: "Gluten-containing grains",
    children: [
      {
        code: "wheat_gluten",
        name: "Wheat",
      },
      {
        code: "barley",
        name: "Barley",
      },
      {
        code: "rye",
        name: "Rye",
      },
      {
        code: "triticale",
        name: "Triticale",
      },
    ],
  },
  {
    code: "sesame",
    name: "Sesame",
    description: "Sesamum indicum",
  },
  {
    code: "mustard",
    name: "Mustard",
    description: "Brassica spp. (EU allergen)",
  },
  {
    code: "celery",
    name: "Celery",
    description: "Apium graveolens (EU allergen)",
  },
  {
    code: "lupin",
    name: "Lupin",
    description: "Lupinus spp. (EU allergen, legume)",
  },
  {
    code: "sulfite",
    name: "Sulfites",
    description: "Sulfur dioxide and sulfites (>10ppm)",
  },
];

/**
 * Flatten the taxonomy tree into a map for efficient lookups
 */
export function buildAllergenMap(): Map<string, { name: string; description?: string; parent?: string }> {
  const map = new Map<string, { name: string; description?: string; parent?: string }>();

  function traverse(nodes: AllergenTaxonomyNode[], parent?: string) {
    for (const node of nodes) {
      map.set(node.code, {
        name: node.name,
        description: node.description,
        parent,
      });
      if (node.children) {
        traverse(node.children, node.code);
      }
    }
  }

  traverse(allergenTaxonomy);
  return map;
}

/**
 * Get all descendant allergen codes for a given allergen code
 * Used when includeDescendants is true on a rule
 */
export function getDescendants(allergenCode: string, taxonomy = allergenTaxonomy): string[] {
  const descendants: string[] = [];

  function traverse(nodes: AllergenTaxonomyNode[]): boolean {
    for (const node of nodes) {
      if (node.code === allergenCode) {
        collectChildren(node.children || []);
        return true;
      }
      if (node.children && traverse(node.children)) {
        return true;
      }
    }
    return false;
  }

  function collectChildren(nodes: AllergenTaxonomyNode[]) {
    for (const node of nodes) {
      descendants.push(node.code);
      if (node.children) {
        collectChildren(node.children);
      }
    }
  }

  traverse(taxonomy);
  return descendants;
}

/**
 * Get all ancestors for a given allergen code
 */
export function getAncestors(allergenCode: string, map = buildAllergenMap()): string[] {
  const ancestors: string[] = [];
  let current = map.get(allergenCode)?.parent;
  
  while (current) {
    ancestors.push(current);
    current = map.get(current)?.parent;
  }
  
  return ancestors;
}
