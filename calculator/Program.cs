using Calculator.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddGrpc();
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 500;
});

builder.Services.AddSingleton<BeatmapCache>();
builder.Services.AddSingleton<HitResultGeneration>();

var app = builder.Build();
app.MapGrpcService<CalculatorService>();
app.Run();