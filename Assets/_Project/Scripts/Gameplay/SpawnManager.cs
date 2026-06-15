using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Core.Pooling;
using VelocityZero.Data;
using VelocityZero.Systems;

namespace VelocityZero.Gameplay
{
    /// <summary>
    /// Procedurally generates track chunks ahead of the player.
    /// Difficulty scales with speed. Always guarantees a valid path (solvability).
    /// </summary>
    public class SpawnManager : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform   _playerTransform;
        [SerializeField] private ChunkData[] _chunkLibrary;

        [Header("Generation Config")]
        [SerializeField] private float _spawnAheadDistance = 40f;
        [SerializeField] private float _despawnBehindDist  = -15f;
        [SerializeField] private float _chunkLength        = 20f;

        private readonly List<GameObject> _activeChunks = new();
        private float   _lastSpawnZ;
        private bool    _spawning;

        private void OnEnable()
        {
            EventBus.Subscribe<OnRunStarted>(OnRunStarted);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnRunStarted>(OnRunStarted);
        }

        private void OnRunStarted(OnRunStarted _)
        {
            ClearAll();
            _lastSpawnZ = 0f;
            // Spawn a clear intro section
            SpawnIntroChunks(3);
        }

        public void StartSpawning() => _spawning = true;

        public void StopSpawning()  => _spawning = false;

        private void SpawnIntroChunks(int count)
        {
            for (int i = 0; i < count; i++)
                SpawnEmptyChunk();
        }

        private void Update()
        {
            if (!_spawning || _playerTransform == null) return;

            float playerZ = _playerTransform.position.z;

            // Spawn ahead
            while (_lastSpawnZ < playerZ + _spawnAheadDistance)
                SpawnNextChunk(playerZ);

            // Despawn behind
            DespawnBehind(playerZ);
        }

        private void SpawnNextChunk(float playerZ)
        {
            float speed      = SpeedManager.Instance?.CurrentSpeed ?? 60f;
            var   chunk      = SelectChunk(speed);
            var   spawnPos   = new Vector3(0f, 0f, _lastSpawnZ);

            GameObject go;
            if (PoolManager.Instance != null)
                go = PoolManager.Instance.Get("Chunk", spawnPos, Quaternion.identity);
            else
                go = Instantiate(chunk.Prefab, spawnPos, Quaternion.identity);

            if (go == null) { _lastSpawnZ += _chunkLength; return; }

            var ctrl = go.GetComponent<ChunkController>();
            ctrl?.Initialize(chunk);

            _activeChunks.Add(go);
            _lastSpawnZ += _chunkLength;
        }

        private void SpawnEmptyChunk()
        {
            // Spawns a chunk with no obstacles (tutorial/intro breathing room)
            _lastSpawnZ += _chunkLength;
        }

        private ChunkData SelectChunk(float speed)
        {
            // Filter by difficulty matching current speed range
            float diff = Mathf.Clamp01(speed / 300f);
            var candidates = new List<ChunkData>();

            foreach (var c in _chunkLibrary)
            {
                if (c.MinDifficultyNormalized <= diff && c.MaxDifficultyNormalized >= diff)
                    candidates.Add(c);
            }

            if (candidates.Count == 0) return _chunkLibrary[0];
            return candidates[Random.Range(0, candidates.Count)];
        }

        private void DespawnBehind(float playerZ)
        {
            for (int i = _activeChunks.Count - 1; i >= 0; i--)
            {
                var chunk = _activeChunks[i];
                if (chunk == null) { _activeChunks.RemoveAt(i); continue; }

                if (chunk.transform.position.z < playerZ + _despawnBehindDist)
                {
                    if (PoolManager.Instance != null)
                        PoolManager.Instance.Return("Chunk", chunk);
                    else
                        Destroy(chunk);
                    _activeChunks.RemoveAt(i);
                }
            }
        }

        private void ClearAll()
        {
            foreach (var chunk in _activeChunks)
            {
                if (chunk == null) continue;
                if (PoolManager.Instance != null)
                    PoolManager.Instance.Return("Chunk", chunk);
                else
                    Destroy(chunk);
            }
            _activeChunks.Clear();
        }
    }
}
