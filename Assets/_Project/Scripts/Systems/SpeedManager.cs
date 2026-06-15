using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Data;

namespace VelocityZero.Systems
{
    /// <summary>
    /// Heart of Velocity Zero. Manages the speed curve V(t) and persistent anchors.
    /// V(t) = Vbase + Amax * (1 - e^(-t / Tau))
    /// </summary>
    public class SpeedManager : MonoBehaviour
    {
        public static SpeedManager Instance { get; private set; }

        [SerializeField] private AnchorConfig _config;

        // ---- Runtime ----
        public float CurrentSpeed      { get; private set; }
        public float BaseSpeed         { get; private set; }  // Anchor start speed
        public float MaxSpeedThisRun   { get; private set; }
        public float RunTime           { get; private set; }
        public bool  IsRunning         { get; private set; }
        public float NormalizedZoneProgress => Mathf.Clamp01(
            (CurrentSpeed - MaxSpeedThisRun) / (_config.ZoneActivationDelta));

        private float _zoneMult = 1f;
        private bool  _inZone;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnZoneStateChanged>(OnZoneStateChanged);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnZoneStateChanged>(OnZoneStateChanged);
        }

        private void OnZoneStateChanged(OnZoneStateChanged e)
        {
            _inZone   = e.State == ZoneState.Active;
            _zoneMult = _inZone ? _config.ZoneSpeedMultiplier : 1f;
        }

        public void StartRun()
        {
            BaseSpeed       = AnchorSystem.Instance.GetStartSpeed();
            CurrentSpeed    = BaseSpeed;
            MaxSpeedThisRun = BaseSpeed;
            RunTime         = 0f;
            IsRunning       = true;

            EventBus.Publish(new OnRunStarted { StartSpeed = BaseSpeed });
        }

        public void StopRun()
        {
            IsRunning = false;
            // Check if a new anchor can be awarded
            AnchorSystem.Instance.TryUnlockAnchor(MaxSpeedThisRun);
        }

        private void Update()
        {
            if (!IsRunning) return;

            RunTime += Time.deltaTime;

            // V(t) = Vbase + Amax*(1 - e^(-t/Tau)) scaled by zone mult
            float rawSpeed = BaseSpeed
                + _config.Amax * (1f - Mathf.Exp(-RunTime / _config.Tau));
            CurrentSpeed = rawSpeed * _zoneMult;

            if (CurrentSpeed > MaxSpeedThisRun)
                MaxSpeedThisRun = CurrentSpeed;

            float normalized = Mathf.Clamp01(
                (CurrentSpeed - BaseSpeed) / _config.Amax);

            EventBus.Publish(new OnSpeedChanged
            {
                Speed              = CurrentSpeed,
                NormalizedProgress = normalized
            });
        }

        /// <summary>World-space units per second (obstacles move at this rate).</summary>
        public float GetObstacleSpeed() => CurrentSpeed * _config.SpeedToWorldScale;
    }
}
