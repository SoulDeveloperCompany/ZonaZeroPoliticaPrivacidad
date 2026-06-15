using UnityEngine;

namespace VelocityZero.Data
{
    [CreateAssetMenu(menuName = "VelocityZero/ChunkData", fileName = "NewChunkData")]
    public class ChunkData : ScriptableObject
    {
        public string    Id;
        public GameObject Prefab;

        [Range(0f, 1f)] public float MinDifficultyNormalized;
        [Range(0f, 1f)] public float MaxDifficultyNormalized = 1f;

        [Tooltip("True if this chunk always has a safe path at any speed")]
        public bool Solvable = true;

        [TextArea] public string DesignNotes;
    }
}
