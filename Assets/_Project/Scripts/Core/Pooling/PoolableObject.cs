using UnityEngine;

namespace VelocityZero.Core.Pooling
{
    /// <summary>
    /// Attach to any prefab that should be managed by PoolManager.
    /// Provides a Return() shortcut back to its owning pool.
    /// </summary>
    public class PoolableObject : MonoBehaviour
    {
        public string PoolKey { get; set; }

        public void Return()
        {
            if (!string.IsNullOrEmpty(PoolKey) && PoolManager.Instance != null)
                PoolManager.Instance.Return(PoolKey, gameObject);
            else
                gameObject.SetActive(false);
        }

        private void OnDisable()
        {
            // Reset any runtime state in subclasses
            OnReturnToPool();
        }

        protected virtual void OnReturnToPool() { }
    }
}
