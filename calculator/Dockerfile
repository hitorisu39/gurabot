FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY proto/ ./proto/
COPY calculator/Calculator.csproj ./calculator/

RUN dotnet restore calculator/Calculator.csproj -r linux-musl-x64

COPY calculator/ ./calculator/

WORKDIR /src/calculator

RUN dotnet publish Calculator.csproj -c Release \
    -r linux-musl-x64 \
    --self-contained true \
    -p:PublishSingleFile=true \
    -p:PublishTrimmed=true \
    -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine AS runtime
WORKDIR /app

COPY --from=build /app/publish/Calculator ./Calculator

RUN chmod +x ./Calculator

ENTRYPOINT ["./Calculator"]