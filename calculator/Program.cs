using Calculator.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddGrpc();

builder.Services.Configure<CalculatorRuntimeOptions>(
    builder.Configuration.GetSection("Calculator")
);

builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 500;
});

builder.Services.AddSingleton<BeatmapCache>();
builder.Services.AddSingleton<HitResultGeneration>();
builder.Services.AddSingleton<PartialDifficultyCache>();
builder.Services.AddSingleton<PartialDifficultyService>();
builder.Services.AddSingleton<CalculationConcurrencyLimiter>();

var app = builder.Build();

app.MapGrpcService<CalculatorService>();

app.Run();