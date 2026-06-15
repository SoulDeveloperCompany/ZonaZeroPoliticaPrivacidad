using UnityEngine;
using VelocityZero.Core;

namespace VelocityZero.Data
{
    [CreateAssetMenu(menuName = "VelocityZero/CharacterData", fileName = "NewCharacterData")]
    public class CharacterData : ScriptableObject
    {
        [Header("Identity")]
        public string          Id;
        public string          DisplayName;
        [TextArea(2, 4)]
        public string          Description;
        public CharacterRarity Rarity;

        [Header("Visuals")]
        public Sprite          Portrait;
        public Sprite          FullArt;
        public GameObject      Prefab;
        public Color           RarityColor = Color.white;

        [Header("Passive Ability")]
        public string          AbilityName;
        [TextArea(1, 3)]
        public string          AbilityDescription;
        public float           AbilityValue; // Contextual: percentage, seconds, etc.

        [Header("Unlock")]
        public int             SparkCost;
        public int             CoreCost;
        public int             FragmentsRequired;
        public bool            IsDefault;

        [Header("Evolution")]
        public int             FragmentsToEvoOne;
        public int             SparksCostEvoOne;
        public int             FragmentsToEvoTwo;
        public int             SparksCostEvoTwo;
        public Sprite          EvoOnePortrait;
        public Sprite          EvoTwoPortrait;
        public GameObject      EvoOnePrefab;
        public GameObject      EvoTwoPrefab;
    }
}
