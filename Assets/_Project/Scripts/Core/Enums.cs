namespace VelocityZero.Core
{
    public enum GameState
    {
        Boot,
        MainMenu,
        InGame,
        Paused,
        GameOver
    }

    public enum LaneIndex
    {
        Left   = 0,
        Center = 1,
        Right  = 2
    }

    public enum ObstacleType
    {
        Static,
        Dynamic,
        High,
        Low,
        Timed,
        Chaser
    }

    public enum PowerUpType
    {
        Magnet,
        Shield,
        ScoreMultiplier,
        SlowTime,
        Rocket
    }

    public enum CharacterRarity
    {
        Common,
        Rare,
        Epic,
        Legendary,
        Mythic
    }

    public enum SwipeDirection
    {
        None,
        Left,
        Right,
        Up,
        Down
    }

    public enum ZoneState
    {
        Inactive,
        Charging,
        Active
    }
}
