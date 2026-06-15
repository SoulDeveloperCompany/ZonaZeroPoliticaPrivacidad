using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using VelocityZero.Systems;
using VelocityZero.Gameplay;

namespace VelocityZero.Core
{
    /// <summary>
    /// Central state machine. Single entry point for game-wide state transitions.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        public GameState CurrentState { get; private set; } = GameState.Boot;

        [Header("Scene Names")]
        [SerializeField] private string _mainMenuScene = "MainMenu";
        [SerializeField] private string _gameScene      = "Game";

        [Header("References (Game Scene)")]
        [SerializeField] private SpeedManager       _speedManager;
        [SerializeField] private SpawnManager       _spawnManager;
        [SerializeField] private PlayerController   _playerController;

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            TransitionTo(GameState.MainMenu);
        }

        public void StartRun()
        {
            if (CurrentState == GameState.InGame) return;
            TransitionTo(GameState.InGame);
        }

        public void PauseRun()
        {
            if (CurrentState != GameState.InGame) return;
            Time.timeScale = 0f;
            TransitionTo(GameState.Paused);
        }

        public void ResumeRun()
        {
            if (CurrentState != GameState.Paused) return;
            Time.timeScale = 1f;
            TransitionTo(GameState.InGame);
        }

        public void EndRun(RunResult result)
        {
            if (CurrentState != GameState.InGame) return;
            TransitionTo(GameState.GameOver);
            EventBus.Publish(new OnRunEnded { Result = result });
        }

        public void GoToMainMenu()
        {
            Time.timeScale = 1f;
            TransitionTo(GameState.MainMenu);
        }

        public void RestartRun() => StartCoroutine(RestartCoroutine());

        private IEnumerator RestartCoroutine()
        {
            TransitionTo(GameState.Boot);
            yield return null;
            TransitionTo(GameState.InGame);
        }

        private void TransitionTo(GameState next)
        {
            CurrentState = next;
            EventBus.Publish(new OnGameStateChanged { NewState = next });

            switch (next)
            {
                case GameState.MainMenu:
                    Time.timeScale = 1f;
                    break;

                case GameState.InGame:
                    Time.timeScale = 1f;
                    _speedManager?.StartRun();
                    _spawnManager?.StartSpawning();
                    _playerController?.EnableInput(true);
                    break;

                case GameState.Paused:
                    _playerController?.EnableInput(false);
                    break;

                case GameState.GameOver:
                    _speedManager?.StopRun();
                    _spawnManager?.StopSpawning();
                    _playerController?.EnableInput(false);
                    break;
            }
        }
    }
}
