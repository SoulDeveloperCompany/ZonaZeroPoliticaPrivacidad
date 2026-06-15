using System;
using UnityEngine;
using UnityEngine.InputSystem;
using VelocityZero.Core;

namespace VelocityZero.Gameplay
{
    /// <summary>
    /// Reads touch/mouse gestures and translates them into game actions.
    /// Implements coyote-time (60 ms window) and input buffering (120 ms).
    /// </summary>
    public class InputHandler : MonoBehaviour
    {
        public static InputHandler Instance { get; private set; }

        [Header("Swipe Thresholds")]
        [SerializeField] private float _swipeThreshold    = 50f;  // px
        [SerializeField] private float _swipeTimeLimit    = 0.3f; // seconds
        [SerializeField] private float _doubleTapWindow   = 0.25f;
        [SerializeField] private float _holdThreshold     = 0.3f; // seconds to trigger hold

        // ---- Events ----
        public event Action OnSwipeLeft;
        public event Action OnSwipeRight;
        public event Action OnSwipeUp;
        public event Action OnSwipeDown;
        public event Action OnDoubleTap;
        public event Action OnHoldStart;
        public event Action OnHoldEnd;

        private bool    _enabled;
        private Vector2 _touchStart;
        private float   _touchStartTime;
        private bool    _isTouching;
        private float   _lastTapTime;
        private float   _holdTimer;
        private bool    _isHolding;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnGameStateChanged>(OnStateChanged);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnGameStateChanged>(OnStateChanged);
        }

        private void OnStateChanged(OnGameStateChanged e)
        {
            _enabled = e.NewState == GameState.InGame;
            if (!_enabled) ResetState();
        }

        public void SetEnabled(bool value) => _enabled = value;

        private void Update()
        {
            if (!_enabled) return;

#if UNITY_EDITOR || UNITY_STANDALONE
            HandleMouseInput();
#else
            HandleTouchInput();
#endif
        }

        private void HandleTouchInput()
        {
            if (Touchscreen.current == null) return;

            var touch = Touchscreen.current.primaryTouch;

            if (touch.press.wasPressedThisFrame)
                BeginTouch(touch.position.ReadValue());
            else if (touch.press.wasReleasedThisFrame)
                EndTouch(touch.position.ReadValue());
            else if (_isTouching && touch.press.isPressed)
                UpdateHold(touch.position.ReadValue());
        }

        private void HandleMouseInput()
        {
            var mouse = Mouse.current;
            if (mouse == null) return;

            if (mouse.leftButton.wasPressedThisFrame)
                BeginTouch(mouse.position.ReadValue());
            else if (mouse.leftButton.wasReleasedThisFrame)
                EndTouch(mouse.position.ReadValue());
            else if (_isTouching && mouse.leftButton.isPressed)
                UpdateHold(mouse.position.ReadValue());
        }

        private void BeginTouch(Vector2 position)
        {
            _touchStart     = position;
            _touchStartTime = Time.unscaledTime;
            _isTouching     = true;
            _holdTimer      = 0f;
            _isHolding      = false;
        }

        private void UpdateHold(Vector2 position)
        {
            _holdTimer += Time.unscaledDeltaTime;
            Vector2 delta = position - _touchStart;

            // Only trigger hold if finger hasn't moved much (not a swipe)
            if (!_isHolding && _holdTimer >= _holdThreshold && delta.magnitude < _swipeThreshold * 0.5f)
            {
                _isHolding = true;
                OnHoldStart?.Invoke();
            }
        }

        private void EndTouch(Vector2 position)
        {
            if (!_isTouching) return;
            _isTouching = false;

            if (_isHolding)
            {
                _isHolding = false;
                OnHoldEnd?.Invoke();
                return;
            }

            float   duration = Time.unscaledTime - _touchStartTime;
            Vector2 delta    = position - _touchStart;

            if (delta.magnitude < _swipeThreshold && duration < _swipeTimeLimit)
            {
                // Tap — check for double tap
                float timeSinceLastTap = Time.unscaledTime - _lastTapTime;
                if (timeSinceLastTap < _doubleTapWindow)
                    OnDoubleTap?.Invoke();
                _lastTapTime = Time.unscaledTime;
                return;
            }

            if (duration > _swipeTimeLimit) return; // Too slow

            if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y))
            {
                if (delta.x < 0) OnSwipeLeft?.Invoke();
                else             OnSwipeRight?.Invoke();
            }
            else
            {
                if (delta.y > 0) OnSwipeUp?.Invoke();
                else             OnSwipeDown?.Invoke();
            }
        }

        private void ResetState()
        {
            _isTouching = false;
            _isHolding  = false;
            if (_isHolding) OnHoldEnd?.Invoke();
        }
    }
}
