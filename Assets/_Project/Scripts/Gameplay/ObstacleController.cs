using System.Collections;
using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Core.Pooling;
using VelocityZero.Data;

namespace VelocityZero.Gameplay
{
    /// <summary>
    /// Individual obstacle behavior. Handles telegraphing, near-miss detection,
    /// and collision triggers.
    /// </summary>
    public class ObstacleController : PoolableObject
    {
        [SerializeField] private ObstacleData _data;
        [SerializeField] private Renderer     _renderer;
        [SerializeField] private Collider     _mainCollider;
        [SerializeField] private Collider     _nearMissTrigger; // Slightly larger than main

        [Header("Telegraph")]
        [SerializeField] private GameObject _warningIndicator;
        [SerializeField] private float      _telegraphDuration = 0.4f;

        private PlayerController _player;
        private bool  _triggered;
        private bool  _nearMissTriggered;

        private void Start()
        {
            _player = FindObjectOfType<PlayerController>();
        }

        public void ResetState()
        {
            _triggered        = false;
            _nearMissTriggered = false;
            if (_warningIndicator != null)
                _warningIndicator.SetActive(false);
        }

        public void Initialize(ObstacleData data)
        {
            _data = data;
            StartCoroutine(TelegraphRoutine());
        }

        private IEnumerator TelegraphRoutine()
        {
            // Flash warning indicator before obstacle arrives
            if (_warningIndicator != null)
            {
                _warningIndicator.SetActive(true);
                yield return new WaitForSeconds(_telegraphDuration);
                _warningIndicator.SetActive(false);
            }
        }

        // ---- Collision (fatal) ----

        private void OnTriggerEnter(Collider other)
        {
            if (_triggered) return;
            if (!other.CompareTag("Player")) return;

            // Check if player is dashing (invincible)
            var player = other.GetComponentInParent<PlayerController>();
            if (player != null && player.IsDashing) return;

            _triggered = true;
            player?.Die();
        }

        // ---- Near Miss ----

        private void OnTriggerStay(Collider other)
        {
            if (_nearMissTriggered) return;
            if (!other.CompareTag("NearMissDetector")) return;
            if (_triggered) return;

            // Only count as near-miss if the player is in an adjacent volume
            // (not overlapping the fatal collider)
            if (!_mainCollider.bounds.Intersects(other.bounds))
            {
                _nearMissTriggered = true;
                _player?.RegisterNearMiss();
            }
        }
    }
}
