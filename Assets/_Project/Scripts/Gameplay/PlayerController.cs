using System.Collections;
using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Systems;

namespace VelocityZero.Gameplay
{
    /// <summary>
    /// Controls player movement across 3 lanes.
    /// Responds to InputHandler gestures: swipe left/right, up (jump), down (slide), double-tap (dash), hold (brake).
    /// </summary>
    [RequireComponent(typeof(Collider))]
    [RequireComponent(typeof(Rigidbody))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Lane Settings")]
        [SerializeField] private float   _laneWidth       = 2f;
        [SerializeField] private float   _laneChangeDur   = 0.1f;  // seconds
        [SerializeField] private float   _coyoteTime      = 0.09f; // seconds of input forgiveness

        [Header("Jump / Slide")]
        [SerializeField] private float   _jumpHeight      = 2.5f;
        [SerializeField] private float   _jumpDuration    = 0.5f;
        [SerializeField] private float   _slideDuration   = 0.6f;

        [Header("Dash")]
        [SerializeField] private int     _maxDashCharges  = 2;
        [SerializeField] private float   _dashCooldown    = 5f;
        [SerializeField] private float   _dashDuration    = 0.15f;

        [Header("Brake")]
        [SerializeField] private float   _brakeSpeedMult  = 0.4f;  // Reduces speed to 40%

        [Header("Near Miss")]
        [SerializeField] private float   _nearMissDistance = 0.4f; // units from obstacle center

        [Header("Animator")]
        [SerializeField] private Animator _animator;

        // ---- Runtime ----
        private LaneIndex  _currentLane  = LaneIndex.Center;
        private LaneIndex  _targetLane   = LaneIndex.Center;
        private bool       _isChangingLane;
        private bool       _isJumping;
        private bool       _isSliding;
        private bool       _isDashing;
        private bool       _isBraking;
        private bool       _isDead;
        private int        _dashCharges;
        private float      _dashCooldownTimer;
        private Coroutine  _laneRoutine;
        private Coroutine  _jumpRoutine;
        private Coroutine  _slideRoutine;
        private Rigidbody  _rb;
        private Vector3    _basePosition;

        // Animator hashes
        private static readonly int AnimRun    = Animator.StringToHash("Run");
        private static readonly int AnimJump   = Animator.StringToHash("Jump");
        private static readonly int AnimSlide  = Animator.StringToHash("Slide");
        private static readonly int AnimDash   = Animator.StringToHash("Dash");
        private static readonly int AnimDie    = Animator.StringToHash("Die");

        private void Awake()
        {
            _rb           = GetComponent<Rigidbody>();
            _rb.isKinematic = true; // We drive position manually
            _dashCharges  = _maxDashCharges;
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnRunStarted>(OnRunStarted);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnRunStarted>(OnRunStarted);
            UnsubscribeInput();
        }

        private void OnRunStarted(OnRunStarted _)
        {
            _currentLane = LaneIndex.Center;
            _targetLane  = LaneIndex.Center;
            _isDead      = false;
            _dashCharges = _maxDashCharges;
            transform.localPosition = new Vector3(0f, 0f, transform.localPosition.z);
            _basePosition = transform.position;
            _animator?.SetTrigger(AnimRun);
        }

        public void EnableInput(bool value)
        {
            if (value) SubscribeInput();
            else       UnsubscribeInput();
        }

        private void SubscribeInput()
        {
            if (InputHandler.Instance == null) return;
            InputHandler.Instance.OnSwipeLeft  += TryMoveLeft;
            InputHandler.Instance.OnSwipeRight += TryMoveRight;
            InputHandler.Instance.OnSwipeUp    += TryJump;
            InputHandler.Instance.OnSwipeDown  += TrySlide;
            InputHandler.Instance.OnDoubleTap  += TryDash;
            InputHandler.Instance.OnHoldStart  += StartBrake;
            InputHandler.Instance.OnHoldEnd    += StopBrake;
        }

        private void UnsubscribeInput()
        {
            if (InputHandler.Instance == null) return;
            InputHandler.Instance.OnSwipeLeft  -= TryMoveLeft;
            InputHandler.Instance.OnSwipeRight -= TryMoveRight;
            InputHandler.Instance.OnSwipeUp    -= TryJump;
            InputHandler.Instance.OnSwipeDown  -= TrySlide;
            InputHandler.Instance.OnDoubleTap  -= TryDash;
            InputHandler.Instance.OnHoldStart  -= StartBrake;
            InputHandler.Instance.OnHoldEnd    -= StopBrake;
        }

        private void Update()
        {
            if (_isDead) return;

            HandleDashRecharge();
            CheckNearMiss();
        }

        // ---- Lane Movement ----

        private void TryMoveLeft()
        {
            if (_isDead) return;
            int next = (int)_currentLane - 1;
            if (next < 0) return;
            ChangeLane((LaneIndex)next);
        }

        private void TryMoveRight()
        {
            if (_isDead) return;
            int next = (int)_currentLane + 1;
            if (next > 2) return;
            ChangeLane((LaneIndex)next);
        }

        private void ChangeLane(LaneIndex target)
        {
            LaneIndex from = _currentLane;
            _currentLane   = target;
            _targetLane    = target;

            if (_laneRoutine != null) StopCoroutine(_laneRoutine);
            _laneRoutine = StartCoroutine(SlideLane(target));

            EventBus.Publish(new OnLaneChanged { From = from, To = target });
        }

        private IEnumerator SlideLane(LaneIndex target)
        {
            _isChangingLane = true;
            float  startX   = transform.localPosition.x;
            float  endX     = ((int)target - 1) * _laneWidth;
            float  elapsed  = 0f;

            while (elapsed < _laneChangeDur)
            {
                elapsed += Time.deltaTime;
                float t  = Mathf.SmoothStep(0f, 1f, elapsed / _laneChangeDur);
                var  pos = transform.localPosition;
                pos.x    = Mathf.Lerp(startX, endX, t);
                transform.localPosition = pos;
                yield return null;
            }

            var finalPos   = transform.localPosition;
            finalPos.x     = endX;
            transform.localPosition = finalPos;
            _isChangingLane = false;
        }

        // ---- Jump ----

        private void TryJump()
        {
            if (_isDead || _isJumping || _isSliding) return;
            if (_jumpRoutine != null) StopCoroutine(_jumpRoutine);
            _jumpRoutine = StartCoroutine(JumpRoutine());
        }

        private IEnumerator JumpRoutine()
        {
            _isJumping = true;
            _animator?.SetTrigger(AnimJump);

            float half    = _jumpDuration * 0.5f;
            float elapsed = 0f;
            float baseY   = transform.localPosition.y;

            while (elapsed < _jumpDuration)
            {
                elapsed += Time.deltaTime;
                float t  = elapsed / _jumpDuration;
                // Parabolic arc
                float y  = Mathf.Sin(t * Mathf.PI) * _jumpHeight;
                var  pos = transform.localPosition;
                pos.y    = baseY + y;
                transform.localPosition = pos;
                yield return null;
            }

            var endPos   = transform.localPosition;
            endPos.y     = baseY;
            transform.localPosition = endPos;
            _isJumping   = false;
        }

        // ---- Slide ----

        private void TrySlide()
        {
            if (_isDead || _isJumping || _isSliding) return;
            if (_slideRoutine != null) StopCoroutine(_slideRoutine);
            _slideRoutine = StartCoroutine(SlideRoutine());
        }

        private IEnumerator SlideRoutine()
        {
            _isSliding = true;
            _animator?.SetTrigger(AnimSlide);
            // Collapse collider height (done via scale for prototype)
            transform.localScale = new Vector3(1f, 0.5f, 1f);
            yield return new WaitForSeconds(_slideDuration);
            transform.localScale = Vector3.one;
            _isSliding = false;
        }

        // ---- Dash ----

        private void TryDash()
        {
            if (_isDead || _dashCharges <= 0) return;
            _dashCharges--;
            StartCoroutine(DashRoutine());
        }

        private IEnumerator DashRoutine()
        {
            _isDashing = true;
            _animator?.SetTrigger(AnimDash);
            // Dash gives brief invincibility window — handled in CollisionHandler
            yield return new WaitForSeconds(_dashDuration);
            _isDashing = false;
        }

        private void HandleDashRecharge()
        {
            if (_dashCharges >= _maxDashCharges) return;
            _dashCooldownTimer += Time.deltaTime;
            if (_dashCooldownTimer >= _dashCooldown)
            {
                _dashCooldownTimer = 0f;
                _dashCharges = Mathf.Min(_dashCharges + 1, _maxDashCharges);
            }
        }

        // ---- Brake ----

        private void StartBrake()
        {
            _isBraking = true;
            // SpeedManager reads this flag via property
        }

        private void StopBrake()
        {
            _isBraking = false;
        }

        public bool IsBraking  => _isBraking;
        public bool IsDashing  => _isDashing;
        public int  DashCharges => _dashCharges;

        // ---- Near Miss ----

        private void CheckNearMiss()
        {
            // Checked from ObstacleController via trigger collider tagged "NearMiss"
            // Here we expose position for external checks
        }

        // Called by ObstacleController or CollisionHandler
        public void RegisterNearMiss()
        {
            int count = ComboSystem.Instance?.CurrentCombo ?? 0;
            EventBus.Publish(new OnNearMiss { Current = count });
        }

        // ---- Death ----

        public void Die()
        {
            if (_isDead) return;
            _isDead = true;
            _animator?.SetTrigger(AnimDie);
            EventBus.Publish(new OnPlayerDied());
        }
    }
}
