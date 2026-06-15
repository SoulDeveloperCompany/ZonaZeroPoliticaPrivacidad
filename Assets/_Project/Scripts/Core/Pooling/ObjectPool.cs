using System.Collections.Generic;
using UnityEngine;

namespace VelocityZero.Core.Pooling
{
    public class ObjectPool : MonoBehaviour
    {
        [SerializeField] private GameObject _prefab;
        [SerializeField] private int        _initialSize = 10;
        [SerializeField] private bool       _expandable  = true;

        private readonly Queue<GameObject> _available = new();
        private readonly List<GameObject>  _all       = new();

        private void Awake()
        {
            if (_prefab != null) Prewarm(_initialSize);
        }

        /// <summary>Called by PoolManager when creating pools dynamically.</summary>
        public void Init(GameObject prefab, int size)
        {
            _prefab      = prefab;
            _initialSize = size;
            Prewarm(size);
        }

        private void Prewarm(int count)
        {
            for (int i = 0; i < count; i++)
                CreateNew();
        }

        private GameObject CreateNew()
        {
            var obj = Instantiate(_prefab, transform);
            obj.SetActive(false);
            _available.Enqueue(obj);
            _all.Add(obj);
            return obj;
        }

        public GameObject Get(Vector3 position, Quaternion rotation)
        {
            if (_available.Count == 0)
            {
                if (_expandable) CreateNew();
                else return null;
            }

            var obj = _available.Dequeue();
            obj.transform.SetPositionAndRotation(position, rotation);
            obj.SetActive(true);
            return obj;
        }

        public void Return(GameObject obj)
        {
            obj.SetActive(false);
            obj.transform.SetParent(transform);
            _available.Enqueue(obj);
        }

        public void ReturnAll()
        {
            foreach (var obj in _all)
                if (obj.activeInHierarchy)
                    Return(obj);
        }
    }
}
