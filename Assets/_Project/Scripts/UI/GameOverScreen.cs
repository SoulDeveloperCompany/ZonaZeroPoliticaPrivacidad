using TMPro;
using UnityEngine;
using UnityEngine.UI;
using VelocityZero.Core;
using VelocityZero.Systems;

namespace VelocityZero.UI
{
    /// <summary>
    /// "¡CASI!" screen — shown after player dies. Celebrates gains, never punishes.
    /// </summary>
    public class GameOverScreen : MonoBehaviour
    {
        [Header("Header")]
        [SerializeField] private TextMeshProUGUI _titleText;     // "¡CASI!"
        [SerializeField] private GameObject      _newRecordBadge;

        [Header("Stats")]
        [SerializeField] private TextMeshProUGUI _maxSpeedText;
        [SerializeField] private TextMeshProUGUI _distanceText;
        [SerializeField] private TextMeshProUGUI _scoreText;
        [SerializeField] private TextMeshProUGUI _maxComboText;
        [SerializeField] private TextMeshProUGUI _sparksEarnedText;
        [SerializeField] private TextMeshProUGUI _xpEarnedText;

        [Header("Anchor Unlock")]
        [SerializeField] private GameObject      _anchorCard;
        [SerializeField] private TextMeshProUGUI _anchorText;

        [Header("Reward x2")]
        [SerializeField] private Button          _rewardX2Button;
        [SerializeField] private TextMeshProUGUI _rewardX2Label;

        [Header("Actions")]
        [SerializeField] private Button          _retryButton;
        [SerializeField] private Button          _menuButton;

        [Header("XP Bar")]
        [SerializeField] private Slider          _xpBar;
        [SerializeField] private TextMeshProUGUI _levelText;

        private RunResult _lastResult;
        private bool      _rewardDoubled;

        private void Awake()
        {
            _retryButton?.onClick.AddListener(OnRetry);
            _menuButton?.onClick.AddListener(OnMenu);
            _rewardX2Button?.onClick.AddListener(OnRewardX2);
            gameObject.SetActive(false);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnRunEnded>(OnRunEnded);
            EventBus.Subscribe<OnAnchorUnlocked>(OnAnchorUnlocked);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnRunEnded>(OnRunEnded);
            EventBus.Unsubscribe<OnAnchorUnlocked>(OnAnchorUnlocked);
        }

        private void OnRunEnded(OnRunEnded e)
        {
            _lastResult    = e.Result;
            _rewardDoubled = false;
            Populate(e.Result);
            gameObject.SetActive(true);
        }

        private void OnAnchorUnlocked(OnAnchorUnlocked e)
        {
            if (_anchorCard)  _anchorCard.SetActive(true);
            if (_anchorText)  _anchorText.text = $"¡Ancla desbloqueada! {e.AnchorSpeed:F0} km/h";
        }

        private void Populate(RunResult r)
        {
            if (_newRecordBadge) _newRecordBadge.SetActive(r.NewRecord);
            if (_maxSpeedText)   _maxSpeedText.text   = $"{r.MaxSpeed:F0} km/h";
            if (_distanceText)   _distanceText.text   = $"{r.Distance:F0} m";
            if (_scoreText)      _scoreText.text      = r.Score.ToString("N0");
            if (_maxComboText)   _maxComboText.text   = $"x{r.MaxCombo}";
            if (_sparksEarnedText) _sparksEarnedText.text = $"+{r.SparksEarned} ✦";
            if (_xpEarnedText)   _xpEarnedText.text   = $"+{r.XpEarned} XP";
            if (_anchorCard)     _anchorCard.SetActive(false);

            if (_rewardX2Label)
                _rewardX2Label.text = $"Ver anuncio → x2 Chispas (+{r.SparksEarned} extra)";
        }

        private void OnRewardX2()
        {
            if (_rewardDoubled) return;
            // TODO: Show rewarded ad then call GrantDoubleReward
            GrantDoubleReward();
        }

        private void GrantDoubleReward()
        {
            _rewardDoubled = true;
            EconomyManager.Instance?.AddSparks(_lastResult.SparksEarned);
            if (_sparksEarnedText)
                _sparksEarnedText.text = $"+{_lastResult.SparksEarned * 2} ✦";
            if (_rewardX2Button)
                _rewardX2Button.interactable = false;
        }

        private void OnRetry()
        {
            gameObject.SetActive(false);
            GameManager.Instance?.StartRun();
        }

        private void OnMenu()
        {
            gameObject.SetActive(false);
            GameManager.Instance?.GoToMainMenu();
        }
    }
}
