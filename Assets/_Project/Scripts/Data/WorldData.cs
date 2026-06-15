using UnityEngine;

namespace VelocityZero.Data
{
    [CreateAssetMenu(menuName = "VelocityZero/WorldData", fileName = "NewWorldData")]
    public class WorldData : ScriptableObject
    {
        [Header("Identity")]
        public string  Id;
        public string  DisplayName;
        [TextArea(1, 3)]
        public string  Description;

        [Header("Visual Theme")]
        public Color   PrimaryColor   = Color.cyan;
        public Color   SecondaryColor = Color.magenta;
        public Color   FogColor       = Color.black;
        public float   FogDensity     = 0.02f;
        public Material SkyboxMaterial;

        [Header("Audio")]
        public AudioClip MusicTrack;
        [Range(0f, 1f)]
        public float     MusicVolume   = 1f;

        [Header("Chunks")]
        public ChunkData[] ExclusiveChunks;

        [Header("Unlock")]
        public int     RequiredAccountLevel;
        public float   RequiredAnchorSpeed;

        [Header("Difficulty Scaling")]
        [Tooltip("Additional speed added to difficulty calculation in this world")]
        public float   DifficultyBias  = 0f;
    }
}
