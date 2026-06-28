module github.com/sedorofeevd/project-druzya/services/interview

go 1.25.8

require (
	github.com/google/uuid v1.6.0
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0
	github.com/jackc/pgx/v5 v5.10.0
	github.com/shopspring/decimal v1.4.0
	go.uber.org/zap v1.28.0
	google.golang.org/grpc v1.81.1
	google.golang.org/protobuf v1.36.11
)

require (
	github.com/nats-io/nats.go v1.42.0
	github.com/prometheus/client_golang v1.23.2
	github.com/redis/go-redis/v9 v9.21.0
	github.com/sedorofeevd/project-druzya/services/ai v0.0.0
	github.com/sedorofeevd/project-druzya/services/billing v0.0.0
	github.com/sedorofeevd/project-druzya/services/content v0.0.0
	github.com/sedorofeevd/project-druzya/services/identity v0.0.0
	github.com/sedorofeevd/project-druzya/services/recommendation v0.0.0
	github.com/stretchr/testify v1.11.1
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/klauspost/compress v1.18.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/nats-io/nkeys v0.4.11 // indirect
	github.com/nats-io/nuid v1.0.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/client_model v0.6.2 // indirect
	github.com/prometheus/common v0.66.1 // indirect
	github.com/prometheus/procfs v0.16.1 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.yaml.in/yaml/v2 v2.4.2 // indirect
	golang.org/x/crypto v0.53.0 // indirect
	golang.org/x/net v0.56.0 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/sys v0.46.0 // indirect
	golang.org/x/text v0.38.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260610212136-7ab31c22f7ad // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace (
	github.com/sedorofeevd/project-druzya/services/ai => ../ai
	github.com/sedorofeevd/project-druzya/services/billing => ../billing
	github.com/sedorofeevd/project-druzya/services/content => ../content
	github.com/sedorofeevd/project-druzya/services/identity => ../identity
	github.com/sedorofeevd/project-druzya/services/recommendation => ../recommendation
)
