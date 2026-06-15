using UnityEngine;
using VelocityZero.Core.Pooling;
using VelocityZero.Data;
using VelocityZero.Systems;

namespace VelocityZero.Gameplay
{
    /// <summary>
    /// A chunk is a fixed-length segment of track containing obstacles.
    /// The chunk itself moves toward the player (negative Z direction).
    /// </summary>
    public class ChunkController : PoolableObject
    {
        private ChunkData _data;

        public void Initialize(ChunkData data)
        {
            _data = data;
            // Obstacles are children of the chunk prefab, already positioned
            // SpawnManager selects which prefab to use
        }

        private void Update()
        {
            if (SpeedManager.Instance == null) return;

            float speed = SpeedManager.Instance.GetObstacleSpeed();
            transform.position += Vector3.back * speed * Time.deltaTime;
        }

        protected override void OnReturnToPool()
        {
            // Reset any dynamic state on child obstacles
            foreach (var obs in GetComponentsInChildren<ObstacleController>())
                obs.ResetState();
        }
    }
}
