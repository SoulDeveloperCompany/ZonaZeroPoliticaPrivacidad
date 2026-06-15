using System.Collections.Generic;
using UnityEngine;

namespace VelocityZero.Core.Pooling
{
    public class PoolManager : MonoBehaviour
    {
        public static PoolManager Instance { get; private set; }

        [System.Serializable]
        private struct PoolEntry
        {
            public string     Key;
            public GameObject Prefab;
            public int        InitialSize;
        }

        [SerializeField] private PoolEntry[] _pools;

        private readonly Dictionary<string, ObjectPool> _map = new();

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            foreach (var entry in _pools)
            {
                var go   = new GameObject($"Pool_{entry.Key}");
                go.transform.SetParent(transform);
                var pool = go.AddComponent<ObjectPool>();
                // Inject via reflection-free approach: set through a helper setter
                pool.Init(entry.Prefab, entry.InitialSize);
                _map[entry.Key] = pool;
            }
        }

        public GameObject Get(string key, Vector3 pos, Quaternion rot = default)
        {
            if (_map.TryGetValue(key, out var pool))
                return pool.Get(pos, rot);
            Debug.LogWarning($"[PoolManager] No pool found for key: {key}");
            return null;
        }

        public void Return(string key, GameObject obj)
        {
            if (_map.TryGetValue(key, out var pool))
                pool.Return(obj);
            else
                Destroy(obj);
        }

        public void ReturnAll(string key)
        {
            if (_map.TryGetValue(key, out var pool))
                pool.ReturnAll();
        }
    }
}
