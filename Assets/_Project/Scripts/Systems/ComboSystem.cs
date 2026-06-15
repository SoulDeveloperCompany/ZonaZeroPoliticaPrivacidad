using UnityEngine;
using VelocityZero.Core;

namespace VelocityZero.Systems
{
    /// <summary>
    /// Manages near-miss chaining, combo multiplier, and decay.
    /// ComboMult = 1 + min(combo, cap) * 0.05
    /// </summary>
    public class ComboSystem : MonoBehaviour
    {
        public static ComboSystem Instance { get; private set; }

        [SerializeField] private float _decayTime     = 3.5f;
        [SerializeField] private int   _comboCap      = 20;
        [SerializeField] private float _multPerCombo  = 0.05f;

        public int   CurrentCombo  { get; private set; }
        public float Multiplier    { get; private set; } = 1f;
        public int   MaxCombo      { get; private set; }

        private float _decayTimer;
        private bool  _active;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnRunStarted>(OnRunStarted);
            EventBus.Subscribe<OnNearMiss>(OnNearMiss);
            EventBus.Subscribe<OnPlayerDied>(OnPlayerDied);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnRunStarted>(OnRunStarted);
            EventBus.Unsubscribe<OnNearMiss>(OnNearMiss);
            EventBus.Unsubscribe<OnPlayerDied>(OnPlayerDied);
        }

        private void OnRunStarted(OnRunStarted _)
        {
            CurrentCombo = 0;
            MaxCombo     = 0;
            Multiplier   = 1f;
            _active      = true;
            _decayTimer  = _decayTime;
        }

        private void OnNearMiss(OnNearMiss e)
        {
            AddCombo(1);
        }

        public void AddCombo(int amount)
        {
            if (!_active) return;
            CurrentCombo += amount;
            if (CurrentCombo > MaxCombo) MaxCombo = CurrentCombo;
            _decayTimer = _decayTime;
            RecalcMultiplier();
        }

        public void BreakCombo()
        {
            // Combo resets to 0 but score already earned is kept
            CurrentCombo = 0;
            RecalcMultiplier();
        }

        private void OnPlayerDied(OnPlayerDied _)
        {
            _active = false;
        }

        private void Update()
        {
            if (!_active || CurrentCombo == 0) return;

            _decayTimer -= Time.deltaTime;
            if (_decayTimer <= 0f)
            {
                BreakCombo();
            }
        }

        private void RecalcMultiplier()
        {
            Multiplier = 1f + Mathf.Min(CurrentCombo, _comboCap) * _multPerCombo;
            EventBus.Publish(new OnComboChanged
            {
                Combo      = CurrentCombo,
                Multiplier = Multiplier
            });
        }
    }
}
