using UnityEngine;
using VelocityZero.Core;

namespace VelocityZero.Systems
{
    /// <summary>
    /// Manages the ZONE state — the peak flow mechanic.
    /// Zone activates when energy bar fills (collected from orbs + near-misses).
    /// During Zone: slow-motion effect, score multiplier, visual climax.
    /// </summary>
    public class ZoneSystem : MonoBehaviour
    {
        public static ZoneSystem Instance { get; private set; }

        [Header("Zone Config")]
        [SerializeField] private float _maxEnergy         = 100f;
        [SerializeField] private float _energyPerNearMiss = 8f;
        [SerializeField] private float _energyPerOrb      = 5f;
        [SerializeField] private float _zoneDuration       = 6f;
        [SerializeField] private float _zoneScoreMult      = 2.5f;
        [SerializeField] private float _zoneTimeScale      = 0.75f; // Perceptual slow-mo

        public float NormalizedEnergy  => _energy / _maxEnergy;
        public ZoneState State         { get; private set; } = ZoneState.Inactive;
        public float ScoreMultiplier   => State == ZoneState.Active ? _zoneScoreMult : 1f;
        public int   ActivationCount   { get; private set; }

        private float _energy;
        private float _zoneTimer;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnRunStarted>(OnRunStarted);
            EventBus.Subscribe<OnNearMiss>(OnNearMiss);
            EventBus.Subscribe<OnCollectiblePickup>(OnPickup);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnRunStarted>(OnRunStarted);
            EventBus.Unsubscribe<OnNearMiss>(OnNearMiss);
            EventBus.Unsubscribe<OnCollectiblePickup>(OnPickup);
        }

        private void OnRunStarted(OnRunStarted _)
        {
            _energy          = 0f;
            ActivationCount  = 0;
            SetState(ZoneState.Charging);
        }

        private void OnNearMiss(OnNearMiss _) => AddEnergy(_energyPerNearMiss);

        private void OnPickup(OnCollectiblePickup e)
        {
            // Zone orbs give energy
            AddEnergy(_energyPerOrb);
        }

        private void AddEnergy(float amount)
        {
            if (State == ZoneState.Active) return;

            _energy = Mathf.Min(_energy + amount, _maxEnergy);
            EventBus.Publish(new OnZoneEnergyChanged { Normalized = NormalizedEnergy });

            if (_energy >= _maxEnergy)
                ActivateZone();
        }

        private void ActivateZone()
        {
            ActivationCount++;
            _zoneTimer = _zoneDuration;
            SetState(ZoneState.Active);
            Time.timeScale = _zoneTimeScale;
        }

        private void Update()
        {
            if (State != ZoneState.Active) return;

            _zoneTimer -= Time.unscaledDeltaTime;
            if (_zoneTimer <= 0f)
                DeactivateZone();
        }

        private void DeactivateZone()
        {
            Time.timeScale = 1f;
            _energy        = 0f;
            SetState(ZoneState.Charging);
            EventBus.Publish(new OnZoneEnergyChanged { Normalized = 0f });
        }

        private void SetState(ZoneState next)
        {
            State = next;
            EventBus.Publish(new OnZoneStateChanged { State = next });
        }
    }
}
