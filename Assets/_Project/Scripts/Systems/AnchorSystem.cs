using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Data;

namespace VelocityZero.Systems
{
    /// <summary>
    /// Manages permanent speed checkpoints (Anchors).
    /// Anchors persist across sessions — the unique meta-progression mechanic.
    /// </summary>
    public class AnchorSystem : MonoBehaviour
    {
        public static AnchorSystem Instance { get; private set; }

        [SerializeField] private AnchorConfig _config;

        private HashSet<float> _unlockedAnchors = new();
        private float          _selectedAnchor;

        private const string SaveKey = "VZ_Anchors";

        public IReadOnlyCollection<float> UnlockedAnchors => _unlockedAnchors;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            Load();
        }

        /// <summary>Returns the player-selected anchor speed for the upcoming run.</summary>
        public float GetStartSpeed()
        {
            // Player selects via MainMenu; default to lowest anchor or base
            return _selectedAnchor > 0f
                ? _selectedAnchor
                : _config.BaseStartSpeed;
        }

        public void SelectAnchor(float speed) => _selectedAnchor = speed;

        /// <summary>
        /// Called at run end. Awards a new anchor if the player reached
        /// and sustained a new threshold for the required survival window.
        /// </summary>
        public void TryUnlockAnchor(float maxSpeed)
        {
            foreach (float threshold in _config.AnchorThresholds)
            {
                if (maxSpeed >= threshold && !_unlockedAnchors.Contains(threshold))
                {
                    _unlockedAnchors.Add(threshold);
                    Save();
                    EventBus.Publish(new OnAnchorUnlocked { AnchorSpeed = threshold });
                    Debug.Log($"[AnchorSystem] New anchor unlocked: {threshold} km/h");
                    break; // Only one per run to keep it impactful
                }
            }
        }

        public List<float> GetSortedAnchors()
        {
            var list = _unlockedAnchors.ToList();
            list.Sort();
            return list;
        }

        private void Save()
        {
            var data = string.Join(",", _unlockedAnchors);
            PlayerPrefs.SetString(SaveKey, data);
            PlayerPrefs.Save();
        }

        private void Load()
        {
            _unlockedAnchors.Clear();
            var raw = PlayerPrefs.GetString(SaveKey, "");
            if (string.IsNullOrEmpty(raw)) return;

            foreach (var part in raw.Split(','))
            {
                if (float.TryParse(part, out float v))
                    _unlockedAnchors.Add(v);
            }
        }

        public void ResetAnchors()
        {
            _unlockedAnchors.Clear();
            _selectedAnchor = 0f;
            PlayerPrefs.DeleteKey(SaveKey);
        }
    }
}
