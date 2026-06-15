using TMPro;
using UnityEngine;
using UnityEngine.UI;
using VelocityZero.Core;
using VelocityZero.Systems;

namespace VelocityZero.UI
{
    /// <summary>
    /// Drives all in-game HUD elements from EventBus data.
    /// Minimal — stays at screen edges to maximise game world visibility.
    /// </summary>
    public class HUDController : MonoBehaviour
    {
        [Header("Speed")]
        [SerializeField] private TextMeshProUGUI _speedText;
        [SerializeField] private Slider          _speedBar;

        [Header("Score / Combo")]
        [SerializeField] private TextMeshProUGUI _scoreText;
        [SerializeField] private TextMeshProUGUI _comboText;
        [SerializeField] private CanvasGroup     _comboGroup;

        [Header("Zone")]
        [SerializeField] private Slider          _zoneBar;
        [SerializeField] private GameObject      _zoneActiveOverlay;

        [Header("Dash Charges")]
        [SerializeField] private GameObject[]    _dashDots;

        [Header("Pause")]
        [SerializeField] private Button          _pauseButton;

        private void OnEnable()
        {
            EventBus.Subscribe<OnSpeedChanged>(OnSpeedChanged);
            EventBus.Subscribe<OnScoreChanged>(OnScoreChanged);
            EventBus.Subscribe<OnComboChanged>(OnComboChanged);
            EventBus.Subscribe<OnZoneEnergyChanged>(OnZoneEnergy);
            EventBus.Subscribe<OnZoneStateChanged>(OnZoneState);
            EventBus.Subscribe<OnGameStateChanged>(OnGameState);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnSpeedChanged>(OnSpeedChanged);
            EventBus.Unsubscribe<OnScoreChanged>(OnScoreChanged);
            EventBus.Unsubscribe<OnComboChanged>(OnComboChanged);
            EventBus.Unsubscribe<OnZoneEnergyChanged>(OnZoneEnergy);
            EventBus.Unsubscribe<OnZoneStateChanged>(OnZoneState);
            EventBus.Unsubscribe<OnGameStateChanged>(OnGameState);
        }

        private void Start()
        {
            _pauseButton?.onClick.AddListener(() => GameManager.Instance?.PauseRun());
            gameObject.SetActive(false);
        }

        private void OnGameState(OnGameStateChanged e)
        {
            gameObject.SetActive(e.NewState == GameState.InGame);
        }

        private void OnSpeedChanged(OnSpeedChanged e)
        {
            if (_speedText) _speedText.text = $"{e.Speed:F0} km/h";
            if (_speedBar)  _speedBar.value = e.NormalizedProgress;
        }

        private void OnScoreChanged(OnScoreChanged e)
        {
            if (_scoreText) _scoreText.text = e.Score.ToString("N0");
        }

        private void OnComboChanged(OnComboChanged e)
        {
            if (_comboText)
            {
                _comboText.text = e.Combo > 0 ? $"x{e.Multiplier:F1}" : "";
            }
            if (_comboGroup)
            {
                _comboGroup.alpha = e.Combo > 0 ? 1f : 0f;
            }
        }

        private void OnZoneEnergy(OnZoneEnergyChanged e)
        {
            if (_zoneBar) _zoneBar.value = e.Normalized;
        }

        private void OnZoneState(OnZoneStateChanged e)
        {
            if (_zoneActiveOverlay)
                _zoneActiveOverlay.SetActive(e.State == ZoneState.Active);
        }

        public void UpdateDashCharges(int charges, int max)
        {
            for (int i = 0; i < _dashDots.Length; i++)
            {
                if (_dashDots[i] != null)
                    _dashDots[i].SetActive(i < charges);
            }
        }
    }
}
