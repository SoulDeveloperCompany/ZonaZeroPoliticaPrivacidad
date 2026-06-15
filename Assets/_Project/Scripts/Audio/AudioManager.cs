using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Systems;

namespace VelocityZero.Audio
{
    /// <summary>
    /// Reactive audio manager. Music pitch and filter cutoff scale with speed.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Header("Music")]
        [SerializeField] private AudioSource _musicSource;
        [SerializeField] private float       _minPitch   = 0.95f;
        [SerializeField] private float       _maxPitch   = 1.15f;

        [Header("SFX")]
        [SerializeField] private AudioSource _sfxSource;
        [SerializeField] private AudioClip   _nearMissSfx;
        [SerializeField] private AudioClip   _anchorSfx;
        [SerializeField] private AudioClip   _zoneActiveSfx;
        [SerializeField] private AudioClip   _deathSfx;
        [SerializeField] private AudioClip   _laneChangeSfx;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnSpeedChanged>(OnSpeedChanged);
            EventBus.Subscribe<OnNearMiss>(OnNearMiss);
            EventBus.Subscribe<OnAnchorUnlocked>(OnAnchorUnlocked);
            EventBus.Subscribe<OnZoneStateChanged>(OnZoneState);
            EventBus.Subscribe<OnPlayerDied>(OnPlayerDied);
            EventBus.Subscribe<OnLaneChanged>(OnLaneChanged);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnSpeedChanged>(OnSpeedChanged);
            EventBus.Unsubscribe<OnNearMiss>(OnNearMiss);
            EventBus.Unsubscribe<OnAnchorUnlocked>(OnAnchorUnlocked);
            EventBus.Unsubscribe<OnZoneStateChanged>(OnZoneState);
            EventBus.Unsubscribe<OnPlayerDied>(OnPlayerDied);
            EventBus.Unsubscribe<OnLaneChanged>(OnLaneChanged);
        }

        private void OnSpeedChanged(OnSpeedChanged e)
        {
            if (_musicSource == null) return;
            _musicSource.pitch = Mathf.Lerp(_minPitch, _maxPitch, e.NormalizedProgress);
        }

        private void OnNearMiss(OnNearMiss _)     => PlaySfx(_nearMissSfx);
        private void OnAnchorUnlocked(OnAnchorUnlocked _) => PlaySfx(_anchorSfx);
        private void OnPlayerDied(OnPlayerDied _) => PlaySfx(_deathSfx);
        private void OnLaneChanged(OnLaneChanged _) => PlaySfx(_laneChangeSfx);

        private void OnZoneState(OnZoneStateChanged e)
        {
            if (e.State == ZoneState.Active) PlaySfx(_zoneActiveSfx);
        }

        public void PlayMusic(AudioClip clip)
        {
            if (_musicSource == null || clip == null) return;
            _musicSource.clip = clip;
            _musicSource.Play();
        }

        public void PlaySfx(AudioClip clip)
        {
            if (_sfxSource == null || clip == null) return;
            _sfxSource.PlayOneShot(clip);
        }
    }
}
