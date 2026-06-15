using UnityEngine;
using VelocityZero.Core;

namespace VelocityZero.Data
{
    [CreateAssetMenu(menuName = "VelocityZero/ObstacleData", fileName = "NewObstacleData")]
    public class ObstacleData : ScriptableObject
    {
        public string        Id;
        public ObstacleType  Type;
        public GameObject    Prefab;

        [Range(0f, 1f)] public float MinDifficultyNormalized;
        [Range(0f, 1f)] public float MaxDifficultyNormalized = 1f;

        [Tooltip("Which lanes this obstacle can occupy. Bitmask: 0=Left,1=Center,2=Right")]
        public LaneIndex[] OccupiedLanes;

        [Tooltip("Does passing this obstacle count as a near-miss opportunity?")]
        public bool AllowsNearMiss = true;
    }
}
