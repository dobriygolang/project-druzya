module github.com/sedorofeevd/project-druzya/services/focus

go 1.25.8

require (
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0
	github.com/jackc/pgx/v5 v5.10.0
	go.uber.org/zap v1.28.0
	google.golang.org/grpc v1.81.1
	google.golang.org/protobuf v1.36.11
)

require github.com/golang-jwt/jwt/v5 v5.3.1 // indirect

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/sedorofeevd/project-druzya/services/identity v0.0.0
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/net v0.56.0 // indirect
	golang.org/x/sync v0.21.0 // indirect
	golang.org/x/sys v0.46.0 // indirect
	golang.org/x/text v0.38.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260610212136-7ab31c22f7ad // indirect
)

replace github.com/sedorofeevd/project-druzya/services/identity => ../identity
