using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using VelocityZero.Core;
using VelocityZero.Systems;

namespace VelocityZero.UI
{
    public class MainMenuController : MonoBehaviour
    {
        [Header("Currency")]
        [SerializeField] private TextMeshProUGUI _sparksText;
        [SerializeField] private TextMeshProUGUI _coresText;

        [Header("Play")]
        [SerializeField] private Button          _playButton;

        [Header("Anchor Selector")]
        [SerializeField] private Transform       _anchorSelectorParent;
        [SerializeField] private GameObject      _anchorButtonPrefab;

        [Header("Level")]
        [SerializeField] private TextMeshProUGUI _levelText;
        [SerializeField] private Slider          _xpBar;

        private void Awake()
        {
            _playButton?.onClick.AddListener(OnPlay);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnCurrencyChanged>(OnCurrencyChanged);
            EventBus.Subscribe<OnGameStateChanged>(OnGameState);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnCurrencyChanged>(OnCurrencyChanged);
            EventBus.Unsubscribe<OnGameStateChanged>(OnGameState);
        }

        private void Start()
        {
            RefreshCurrency();
            BuildAnchorSelector();
        }

        private void OnGameState(OnGameStateChanged e)
        {
            gameObject.SetActive(e.NewState == GameState.MainMenu);
            if (e.NewState == GameState.MainMenu)
                BuildAnchorSelector();
        }

        private void RefreshCurrency()
        {
            if (EconomyManager.Instance == null) return;
            if (_sparksText) _sparksText.text = EconomyManager.Instance.Sparks.ToString("N0");
            if (_coresText)  _coresText.text  = EconomyManager.Instance.Cores.ToString("N0");
        }

        private void OnCurrencyChanged(OnCurrencyChanged e)
        {
            if (_sparksText) _sparksText.text = e.Sparks.ToString("N0");
            if (_coresText)  _coresText.text  = e.Cores.ToString("N0");
        }

        private void BuildAnchorSelector()
        {
            if (_anchorSelectorParent == null || _anchorButtonPrefab == null) return;

            foreach (Transform child in _anchorSelectorParent)
                Destroy(child.gameObject);

            if (AnchorSystem.Instance == null) return;

            var anchors = AnchorSystem.Instance.GetSortedAnchors();
            // Insert base speed as first option
            anchors.Insert(0, 60f);

            foreach (float speed in anchors)
            {
                var btn   = Instantiate(_anchorButtonPrefab, _anchorSelectorParent);
                var label = btn.GetComponentInChildren<TextMeshProUGUI>();
                if (label) label.text = $"{speed:F0} km/h";

                float captured = speed;
                btn.GetComponent<Button>()?.onClick.AddListener(() =>
                {
                    AnchorSystem.Instance?.SelectAnchor(captured);
                    HighlightAnchorButton(btn);
                });
            }
        }

        private void HighlightAnchorButton(GameObject selected)
        {
            foreach (Transform child in _anchorSelectorParent)
            {
                bool isSelected = child.gameObject == selected;
                // Toggle visual state — assign via script or use toggle group
                var image = child.GetComponent<Image>();
                if (image) image.color = isSelected ? Color.cyan : Color.gray;
            }
        }

        private void OnPlay()
        {
            GameManager.Instance?.StartRun();
        }
    }
}
